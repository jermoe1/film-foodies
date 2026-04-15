import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError, concatMap, toArray, delay } from 'rxjs/operators';
import { SupabaseService } from '../core/services/supabase.service';
import { OmdbService } from '../core/services/omdb.service';
import { Member } from '../core/services/member.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PreviewRow {
  rowNum: number;
  date: string;
  title: string;
  imdbId: string;
  host: string;
  hostMember: Member | null;
  foodMain: string;
  foodSides: string;
  foodDrinks: string;
  watchPlatform: string;
  cutVersion: string;
  photoUrl: string;
  errors: string[];
}

export interface ReadyRow extends PreviewRow {
  resolvedImdbId: string;
  releaseYear: string | null;
  imdbUrl: string | null;
  posterUrl: string | null;
  genre: string | null;
  director: string | null;
  movieCast: string | null;
  runtime: string | null;
  imdbRating: string | null;
  country: string | null;
  movieLanguage: string | null;
}

export interface EnrichProgress {
  current: number;
  total: number;
  title: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  error?: string;
}

// ── CSV template ──────────────────────────────────────────────────────────────

export const CSV_HEADERS =
  'date,title,imdb_id,host,food_main,food_sides,food_drinks,watch_platform,cut_version,photo_url';

export const CSV_EXAMPLE =
  '2023-05-15,The Menu,tt9764362,Jerry,Thai green curry,Popcorn,Wine,Netflix,Standard,';

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class BulkImportService {
  constructor(
    private supabase: SupabaseService,
    private omdb: OmdbService,
  ) {}

  private get client() {
    try { return this.supabase.getClient(); } catch { return null; }
  }

  // ── Parse + validate ────────────────────────────────────────────────────────

  parseAndValidate(csvText: string, members: Member[]): PreviewRow[] {
    const lines = csvText
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) return [];

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));

    return lines.slice(1).map((line, i) => {
      const vals = parseLine(line);
      const get = (key: string) => (vals[headers.indexOf(key)] ?? '').trim();

      const date       = get('date');
      const title      = get('title');
      const imdbId     = get('imdb_id');
      const host       = get('host');
      const foodMain   = get('food_main');
      const foodSides  = get('food_sides');
      const foodDrinks = get('food_drinks');
      const watchPlatform = get('watch_platform');
      const cutVersion = get('cut_version') || 'Standard';
      const photoUrl   = get('photo_url');

      const errors: string[] = [];

      if (!date) {
        errors.push('Date is required');
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push('Date must be YYYY-MM-DD format');
      } else if (isNaN(Date.parse(date))) {
        errors.push('Date is not a valid calendar date');
      }

      if (!title && !imdbId) {
        errors.push('Title or IMDb ID is required');
      }

      const hostMember = host
        ? members.find(
            (m) =>
              m.first_name.toLowerCase() === host.toLowerCase() ||
              m.full_name.toLowerCase() === host.toLowerCase()
          ) ?? null
        : null;

      if (!host) {
        errors.push('Host is required');
      } else if (!hostMember) {
        errors.push(`Host "${host}" does not match any member`);
      }

      return {
        rowNum: i + 2, // +2: 1-indexed, skip header
        date,
        title,
        imdbId,
        host,
        hostMember,
        foodMain,
        foodSides,
        foodDrinks,
        watchPlatform,
        cutVersion,
        photoUrl,
        errors,
      };
    });
  }

  // ── OMDB enrichment ─────────────────────────────────────────────────────────

  enrichRows(
    rows: PreviewRow[],
    onProgress: (p: EnrichProgress) => void,
  ): Observable<ReadyRow[]> {
    const validRows = rows.filter((r) => r.errors.length === 0);
    const total = validRows.length; // all valid rows are enriched from OMDB
    let current = 0;

    return from(validRows).pipe(
      concatMap((row) => {
        onProgress({ current: ++current, total, title: row.title || row.imdbId });
        return this.enrichOne(row).pipe(
          // 200ms between OMDB calls to respect rate limits
          delay(200),
          catchError(() => of(toReadyRow(row, null))),
        );
      }),
      toArray(),
    );
  }

  private enrichOne(row: PreviewRow): Observable<ReadyRow> {
    const client = this.client;
    if (!client) return of(toReadyRow(row, null));

    const fetchFromDb = (id: string): Observable<ReadyRow> =>
      from(
        client
          .from('movies')
          .select(
            'id, title, release_year, imdb_id, imdb_url, poster_url, genre, director, movie_cast, runtime, imdb_rating, country, movie_language',
          )
          .eq('id', id)
          .single(),
      ).pipe(
        map(({ data }) => toReadyRow(row, (data as any) ?? null)),
        catchError(() => of(toReadyRow(row, null))),
      );

    if (row.imdbId) {
      return this.omdb.getOrCacheMovie(row.imdbId).pipe(
        switchMap((dbId) => (dbId ? fetchFromDb(dbId) : of(toReadyRow(row, null)))),
      );
    }

    // Title-only: search then cache
    return this.omdb.searchMovies(row.title).pipe(
      switchMap((results) => {
        const best = results[0];
        if (!best?.imdbId) return of(toReadyRow(row, null));
        return this.omdb.getOrCacheMovie(best.imdbId).pipe(
          switchMap((dbId) => (dbId ? fetchFromDb(dbId) : of(toReadyRow(row, null)))),
        );
      }),
      catchError(() => of(toReadyRow(row, null))),
    );
  }

  // ── Import via RPC ──────────────────────────────────────────────────────────

  importNights(rows: ReadyRow[], createdBy: string): Observable<ImportResult> {
    const client = this.client;
    if (!client) return of({ success: false, imported: 0, error: 'Not connected to database' });

    const payload = rows.map((row) => ({
      title:           row.title,
      release_year:    row.releaseYear,
      imdb_id:         row.resolvedImdbId || null,
      imdb_url:        row.imdbUrl,
      poster_url:      row.posterUrl,
      genre:           row.genre,
      director:        row.director,
      movie_cast:      row.movieCast,
      runtime:         row.runtime,
      imdb_rating:     row.imdbRating,
      country:         row.country,
      movie_language:  row.movieLanguage,
      host_id:         row.hostMember!.id,
      date:            row.date,
      food_main:       row.foodMain || null,
      food_sides:      row.foodSides || null,
      food_drinks:     row.foodDrinks || null,
      watch_platform:  row.watchPlatform || null,
      cut_version:     row.cutVersion || 'Standard',
      subtitle_option: null,
      photo_url:       row.photoUrl || null,
      created_by:      createdBy,
    }));

    return from(
      client.rpc('bulk_import_movie_nights', { nights: payload })
    ).pipe(
      map(({ data, error }) => {
        if (error) return { success: false, imported: 0, error: error.message };
        const result = data as any;
        return { success: true, imported: result?.imported ?? rows.length };
      }),
      catchError((err) => of({ success: false, imported: 0, error: String(err) })),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function toReadyRow(row: PreviewRow, movie: any): ReadyRow {
  return {
    ...row,
    resolvedImdbId:  movie?.imdb_id   ?? row.imdbId ?? '',
    releaseYear:     movie?.release_year  ?? null,
    imdbUrl:         movie?.imdb_url      ?? null,
    posterUrl:       movie?.poster_url    ?? null,
    genre:           movie?.genre         ?? null,
    director:        movie?.director      ?? null,
    movieCast:       movie?.movie_cast    ?? null,
    runtime:         movie?.runtime       ?? null,
    imdbRating:      movie?.imdb_rating   ?? null,
    country:         movie?.country       ?? null,
    movieLanguage:   movie?.movie_language ?? null,
  };
}
