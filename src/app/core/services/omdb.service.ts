import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { ContentWarningService } from './content-warning.service';
import { ContentWarning, MovieSearchResult } from '../../suggestions/suggestions.types';
import { environment } from '../../../environments/environment';

const OMDB_KEY_STORAGE = 'ff_omdb_key';
const OMDB_BASE = 'https://www.omdbapi.com/';

/** Raw OMDB search hit (from ?s= endpoint). */
interface OmdbSearchHit {
  imdbID: string;
  Title: string;
  Year: string;
  Poster: string;
  Type: string;
}

/** Raw OMDB detail record (from ?i= endpoint). */
interface OmdbDetail {
  imdbID: string;
  Title: string;
  Year: string;
  Genre: string;
  Director: string;
  Actors: string;
  Runtime: string;
  imdbRating: string;
  Poster: string;
  Country: string;
  Language: string;
  Response: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class OmdbService {
  constructor(
    private supabase: SupabaseService,
    private contentWarningService: ContentWarningService,
  ) {}

  private get apiKey(): string | null {
    // Environment key takes priority (injected at build time via GitHub secrets)
    if (environment.omdbApiKey) return environment.omdbApiKey;
    // Local storage fallback for local development
    return localStorage.getItem(OMDB_KEY_STORAGE);
  }

  private get client() {
    try { return this.supabase.getClient(); } catch { return null; }
  }

  /**
   * Search for movies by title.
   * Checks the local movies table first; supplements with OMDB if fewer than 3 DB results.
   */
  searchMovies(query: string): Observable<MovieSearchResult[]> {
    if (!query.trim()) return of([]);
    const client = this.client;

    const dbSearch$: Observable<MovieSearchResult[]> = client
      ? from(
          client
            .from('movies')
            .select('id, title, release_year, poster_url, genre, director, runtime, imdb_rating, imdb_id, imdb_url, movie_language, country, content_warnings')
            .ilike('title', `%${query}%`)
            .limit(8)
        ).pipe(
          map(({ data }) =>
            (data ?? []).map((r: any) => ({
              id: r.id,
              imdbId: r.imdb_id,
              title: r.title,
              releaseYear: r.release_year ? String(r.release_year) : null,
              posterUrl: r.poster_url,
              genre: r.genre,
              director: r.director,
              runtime: r.runtime,
              imdbRating: r.imdb_rating,
              imdbUrl: r.imdb_url,
              movieLanguage: r.movie_language,
              country: r.country,
              contentWarnings: (r.content_warnings as ContentWarning[]) ?? null,
              inDb: true,
            } as MovieSearchResult))
          ),
          catchError(() => of([] as MovieSearchResult[]))
        )
      : of([] as MovieSearchResult[]);

    return dbSearch$.pipe(
      switchMap((dbResults) => {
        if (dbResults.length >= 3 || !this.apiKey) return of(dbResults);
        return this.omdbSearch(query).pipe(
          map((omdbHits) => {
            const existingImdbIds = new Set(dbResults.map((r) => r.imdbId));
            const newFromOmdb: MovieSearchResult[] = omdbHits
              .filter((h) => !existingImdbIds.has(h.imdbID))
              .slice(0, 5)
              .map((h) => ({
                id: null,
                imdbId: h.imdbID,
                title: h.Title,
                releaseYear: h.Year ?? null,
                posterUrl: h.Poster !== 'N/A' ? h.Poster : null,
                genre: null,
                director: null,
                runtime: null,
                imdbRating: null,
                imdbUrl: `https://www.imdb.com/title/${h.imdbID}/`,
                movieLanguage: null,
                country: null,
                contentWarnings: null,
                inDb: false,
              }));
            return [...dbResults, ...newFromOmdb];
          }),
          catchError(() => of(dbResults))
        );
      })
    );
  }

  /**
   * Fetch full OMDB detail for an imdbId and upsert into the movies table.
   * Returns the movie row id from the DB.
   */
  getOrCacheMovie(imdbId: string): Observable<string | null> {
    const client = this.client;
    if (!client) return of(null);

    // Check DB first
    return from(
      client.from('movies').select('id').eq('imdb_id', imdbId).maybeSingle()
    ).pipe(
      switchMap(({ data }) => {
        if (data?.id) return of(data.id as string);
        if (!this.apiKey) return of(null);
        return this.omdbGetById(imdbId).pipe(
          switchMap((detail) => {
            if (!detail || detail.Response === 'False') return of(null);
            const row = {
              title: detail.Title,
              release_year: detail.Year !== 'N/A' ? detail.Year : null,
              imdb_id: detail.imdbID,
              imdb_url: `https://www.imdb.com/title/${detail.imdbID}/`,
              poster_url: detail.Poster !== 'N/A' ? detail.Poster : null,
              genre: detail.Genre !== 'N/A' ? detail.Genre : null,
              director: detail.Director !== 'N/A' ? detail.Director : null,
              movie_cast: detail.Actors !== 'N/A' ? detail.Actors : null,
              runtime: detail.Runtime !== 'N/A' ? detail.Runtime : null,
              imdb_rating: detail.imdbRating !== 'N/A' ? detail.imdbRating : null,
              country: detail.Country !== 'N/A' ? detail.Country : null,
              movie_language: detail.Language !== 'N/A' ? detail.Language : null,
              raw_omdb: detail,
              last_omdb_fetch: new Date().toISOString(),
            };
            return from(
              client.from('movies').insert(row).select('id').single()
            ).pipe(
              map(({ data: inserted }) => (inserted?.id as string) ?? null),
              switchMap((movieId) => {
                if (!movieId) return of(null as string | null);
                // Fetch DTDD warnings and persist them alongside the new movie row
                return this.contentWarningService.fetchWarnings(imdbId).pipe(
                  switchMap((warnings) => {
                    if (!warnings.length) return of(movieId);
                    return from(
                      client
                        .from('movies')
                        .update({ content_warnings: warnings })
                        .eq('id', movieId)
                    ).pipe(map(() => movieId), catchError(() => of(movieId)));
                  }),
                  catchError(() => of(movieId))
                );
              }),
              catchError(() => of(null))
            );
          }),
          catchError(() => of(null))
        );
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Persist content warnings for a movie that was already in the DB but had none.
   * Fire-and-forget safe — called from suggest-new as a side-effect.
   */
  updateContentWarnings(movieId: string, warnings: ContentWarning[]): Observable<void> {
    const client = this.client;
    if (!client || !warnings.length) return of(undefined);
    return from(
      client.from('movies').update({ content_warnings: warnings }).eq('id', movieId)
    ).pipe(map(() => undefined), catchError(() => of(undefined)));
  }

  private omdbSearch(query: string): Observable<OmdbSearchHit[]> {
    const url = `${OMDB_BASE}?s=${encodeURIComponent(query)}&type=movie&apikey=${this.apiKey}`;
    return from(fetch(url).then((r) => r.json())).pipe(
      map((json: any) => (json.Response === 'True' ? (json.Search as OmdbSearchHit[]) : [])),
      catchError(() => of([]))
    );
  }

  private omdbGetById(imdbId: string): Observable<OmdbDetail | null> {
    const url = `${OMDB_BASE}?i=${imdbId}&plot=short&apikey=${this.apiKey}`;
    return from(fetch(url).then((r) => r.json())).pipe(
      map((json: any) => json as OmdbDetail),
      catchError(() => of(null))
    );
  }
}
