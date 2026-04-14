import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from '../core/services/supabase.service';

export interface HistoryMovie {
  id: string;
  title: string;
  releaseYear: string | null;
  posterUrl: string | null;
  genre: string | null;
  director: string | null;
  runtime: string | null;
  imdbRating: string | null;
  imdbUrl: string | null;
  movieLanguage: string | null;
  country: string | null;
  contentWarnings: any[];
}

export interface HistoryAttendee {
  memberId: string;
  memberName: string;
  memberColor: string;
  attended: boolean;
  score: number | null;
  firstWatch: boolean | null;
  reviewNote: string | null;
  tags: string[];
}

export interface HistoryCard {
  id: string;
  date: string;
  hostName: string;
  hostColor: string;
  movie: HistoryMovie;
  watchPlatform: string | null;
  cutVersion: string | null;
  subtitleOption: string | null;
  viewingEnvironment: string[];
  foodMain: string | null;
  foodSides: string | null;
  foodDrinks: string | null;
  photoUrl: string | null;
  avgScore: number | null;
  attendees: HistoryAttendee[];
}

export interface HistoryNote {
  id: string;
  memberId: string;
  memberName: string;
  memberColor: string;
  noteText: string;
  isEdited: boolean;
  createdAt: string;
}

export interface HistoryFact {
  id: string;
  factText: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
}

@Injectable({ providedIn: 'root' })
export class HistoryService {
  constructor(private supabase: SupabaseService) {}

  private get client() {
    try { return this.supabase.getClient(); } catch { return null; }
  }

  /**
   * Load all movie nights (newest first) with movie info, host, attendees, and ratings.
   * Attendees and ratings are merged client-side by member_id.
   */
  getHistory(): Observable<HistoryCard[]> {
    const client = this.client;
    if (!client) return of([]);

    return from(
      client
        .from('movie_nights')
        .select(`
          id, date, food_main, food_sides, food_drinks,
          watch_platform, cut_version, subtitle_option, viewing_environment, photo_url,
          movie:movies!movie_id(
            id, title, release_year, poster_url, genre, director,
            runtime, imdb_rating, imdb_url, movie_language, country, content_warnings
          ),
          host:members!host_id(first_name, avatar_color),
          attendees:movie_night_attendees!movie_night_id(
            member_id, attended,
            member:members!member_id(first_name, avatar_color)
          ),
          ratings:ratings!movie_night_id(
            member_id, score, first_watch, review_note, tags
          )
        `)
        .order('date', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []).map((r: any) => this.mapCard(r));
      }),
      catchError(() => of([]))
    );
  }

  private mapCard(r: any): HistoryCard {
    const attendeeRows = (r.attendees ?? []) as any[];
    const ratingRows = (r.ratings ?? []) as any[];

    const attendees: HistoryAttendee[] = attendeeRows.map((a: any) => {
      const rating = ratingRows.find((rt: any) => rt.member_id === a.member_id);
      return {
        memberId: a.member_id,
        memberName: a.member?.first_name ?? 'Unknown',
        memberColor: a.member?.avatar_color ?? '#888',
        attended: a.attended,
        score: rating?.score ?? null,
        firstWatch: rating?.first_watch ?? null,
        reviewNote: rating?.review_note ?? null,
        tags: rating?.tags ?? [],
      };
    });

    const scores = attendees
      .filter((a) => a.attended && a.score !== null)
      .map((a) => a.score as number);
    const avgScore = scores.length
      ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
      : null;

    return {
      id: r.id,
      date: r.date,
      hostName: r.host?.first_name ?? 'Unknown',
      hostColor: r.host?.avatar_color ?? '#888',
      movie: {
        id: r.movie?.id ?? '',
        title: r.movie?.title ?? '',
        releaseYear: r.movie?.release_year ?? null,
        posterUrl: r.movie?.poster_url ?? null,
        genre: r.movie?.genre ?? null,
        director: r.movie?.director ?? null,
        runtime: r.movie?.runtime ?? null,
        imdbRating: r.movie?.imdb_rating ?? null,
        imdbUrl: r.movie?.imdb_url ?? null,
        movieLanguage: r.movie?.movie_language ?? null,
        country: r.movie?.country ?? null,
        contentWarnings: r.movie?.content_warnings ?? [],
      },
      watchPlatform: r.watch_platform ?? null,
      cutVersion: r.cut_version ?? null,
      subtitleOption: r.subtitle_option ?? null,
      viewingEnvironment: r.viewing_environment ?? [],
      foodMain: r.food_main ?? null,
      foodSides: r.food_sides ?? null,
      foodDrinks: r.food_drinks ?? null,
      photoUrl: r.photo_url ?? null,
      avgScore,
      attendees,
    };
  }

  /** Load notes for one movie night (lazy — called on first tab open). */
  getNotes(movieNightId: string): Observable<HistoryNote[]> {
    const client = this.client;
    if (!client) return of([]);

    return from(
      client
        .from('movie_night_notes')
        .select(`
          id, note_text, is_edited, created_at, member_id,
          member:members!member_id(first_name, avatar_color)
        `)
        .eq('movie_night_id', movieNightId)
        .order('created_at', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []).map((r: any) => ({
          id: r.id,
          memberId: r.member_id,
          memberName: r.member?.first_name ?? 'Unknown',
          memberColor: r.member?.avatar_color ?? '#888',
          noteText: r.note_text,
          isEdited: r.is_edited,
          createdAt: r.created_at,
        } as HistoryNote));
      }),
      catchError(() => of([]))
    );
  }

  /** Load trivia facts for a movie (lazy — called on first tab open). */
  getFacts(movieId: string): Observable<HistoryFact[]> {
    const client = this.client;
    if (!client) return of([]);

    return from(
      client
        .from('fun_facts')
        .select('id, fact_text, source_url, source_label')
        .eq('movie_id', movieId)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []).map((r: any) => ({
          id: r.id,
          factText: r.fact_text,
          sourceUrl: r.source_url ?? null,
          sourceLabel: r.source_label ?? null,
        } as HistoryFact));
      }),
      catchError(() => of([]))
    );
  }

  /** Insert a new note and return the populated row. */
  addNote(
    movieNightId: string,
    memberId: string,
    noteText: string
  ): Observable<HistoryNote | null> {
    const client = this.client;
    if (!client) return of(null);

    return from(
      client
        .from('movie_night_notes')
        .insert({ movie_night_id: movieNightId, member_id: memberId, note_text: noteText })
        .select(`
          id, note_text, is_edited, created_at, member_id,
          member:members!member_id(first_name, avatar_color)
        `)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        const r = data as any;
        return {
          id: r.id,
          memberId: r.member_id,
          memberName: r.member?.first_name ?? 'Unknown',
          memberColor: r.member?.avatar_color ?? '#888',
          noteText: r.note_text,
          isEdited: r.is_edited,
          createdAt: r.created_at,
        } as HistoryNote;
      }),
      catchError(() => of(null))
    );
  }

  /** Edit an existing note's text. The DB trigger sets is_edited = true. */
  updateNote(noteId: string, noteText: string): Observable<boolean> {
    const client = this.client;
    if (!client) return of(false);

    return from(
      client
        .from('movie_night_notes')
        .update({ note_text: noteText })
        .eq('id', noteId)
    ).pipe(
      map(({ error }) => !error),
      catchError(() => of(false))
    );
  }
}
