import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from '../core/services/supabase.service';
import { MovieSearchResult } from '../suggestions/suggestions.types';

export interface MovieNightPayload {
  movieId: string;
  suggestionId: string | null;
  hostId: string;
  date: string;
  foodMain: string;
  foodSides: string;
  foodDrinks: string;
  watchPlatform: string;
  cutVersion: string;
  subtitleOption: string;
  viewingEnvironment: string[];
  photoUrl: string;
  createdBy: string;
}

@Injectable({ providedIn: 'root' })
export class MovieNightsService {
  constructor(private supabase: SupabaseService) {}

  private get client() {
    try { return this.supabase.getClient(); } catch { return null; }
  }

  /**
   * Load a suggestion's movie data for pre-filling the form.
   */
  getSuggestionMovie(
    suggestionId: string
  ): Observable<{ movieId: string; movie: MovieSearchResult } | null> {
    const client = this.client;
    if (!client) return of(null);

    return from(
      client
        .from('movie_suggestions')
        .select(`
          movie_id,
          movie:movies!movie_id(
            id, title, release_year, poster_url, genre, director,
            runtime, imdb_rating, imdb_url, imdb_id, movie_language, country
          )
        `)
        .eq('id', suggestionId)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        const m = (data as any).movie;
        if (!m) return null;
        return {
          movieId: (data as any).movie_id as string,
          movie: {
            id: m.id,
            imdbId: m.imdb_id ?? '',
            title: m.title,
            releaseYear: m.release_year ?? null,
            posterUrl: m.poster_url ?? null,
            genre: m.genre ?? null,
            director: m.director ?? null,
            runtime: m.runtime ?? null,
            imdbRating: m.imdb_rating ?? null,
            imdbUrl: m.imdb_url ?? null,
            movieLanguage: m.movie_language ?? null,
            country: m.country ?? null,
            inDb: true,
          } as MovieSearchResult,
        };
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Insert a new movie night row.
   * The Postgres trigger auto-populates movie_night_attendees for all members.
   * Returns the new movie night's id, or null on failure.
   */
  createMovieNight(payload: MovieNightPayload): Observable<string | null> {
    const client = this.client;
    if (!client) return of(null);

    const row: Record<string, unknown> = {
      movie_id: payload.movieId,
      host_id: payload.hostId,
      date: payload.date,
      created_by: payload.createdBy,
      cut_version: payload.cutVersion || 'Standard',
    };

    if (payload.suggestionId) row['suggestion_id'] = payload.suggestionId;
    if (payload.foodMain.trim()) row['food_main'] = payload.foodMain.trim();
    if (payload.foodSides.trim()) row['food_sides'] = payload.foodSides.trim();
    if (payload.foodDrinks.trim()) row['food_drinks'] = payload.foodDrinks.trim();
    if (payload.watchPlatform) row['watch_platform'] = payload.watchPlatform;
    if (payload.subtitleOption) row['subtitle_option'] = payload.subtitleOption;
    if (payload.viewingEnvironment.length) row['viewing_environment'] = payload.viewingEnvironment;
    if (payload.photoUrl.trim()) row['photo_url'] = payload.photoUrl.trim();

    return from(
      client.from('movie_nights').insert(row).select('id').single()
    ).pipe(
      map(({ data }) => (data as any)?.id ?? null),
      catchError(() => of(null))
    );
  }

  /**
   * Mark a specific attendee as having not attended.
   * Called after createMovieNight, once the trigger has populated the attendee rows.
   */
  updateAttendee(movieNightId: string, memberId: string, attended: boolean): Observable<void> {
    const client = this.client;
    if (!client) return of(undefined);
    return from(
      client
        .from('movie_night_attendees')
        .update({ attended })
        .eq('movie_night_id', movieNightId)
        .eq('member_id', memberId)
    ).pipe(map(() => undefined), catchError(() => of(undefined)));
  }

  /**
   * Mark a suggestion's status as 'selected' after it has been chosen for a movie night.
   */
  markSuggestionSelected(suggestionId: string): Observable<void> {
    const client = this.client;
    if (!client) return of(undefined);
    return from(
      client
        .from('movie_suggestions')
        .update({ status: 'selected' })
        .eq('id', suggestionId)
    ).pipe(map(() => undefined), catchError(() => of(undefined)));
  }
}
