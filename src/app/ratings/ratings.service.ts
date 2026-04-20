import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../core/services/supabase.service';

export interface PendingRating {
  movieNightId: string;
  date: string;
  hostName: string;
  movie: {
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
  };
}

export interface RatingPayload {
  movieNightId: string;
  memberId: string;
  score: number;
  firstWatch: boolean | null;
  reviewNote: string;
  tags: string[];
}

@Injectable({ providedIn: 'root' })
export class RatingsService {
  constructor(private supabase: SupabaseService) {}

  private get client() { return this.supabase.getClientOrNull(); }

  /**
   * Find the most recent movie night this member attended but has not yet rated.
   * Uses three sequential queries to avoid complex join filtering.
   */
  getPendingRating(memberId: string): Observable<PendingRating | null> {
    const client = this.client;
    if (!client) return of(null);

    // 1 — IDs the member has already rated
    return from(
      client.from('ratings').select('movie_night_id').eq('member_id', memberId)
    ).pipe(
      switchMap(({ data: ratedData }) => {
        const ratedIds = (ratedData ?? []).map((r: any) => r.movie_night_id as string);

        // 2 — IDs of movie nights the member attended
        return from(
          client
            .from('movie_night_attendees')
            .select('movie_night_id')
            .eq('member_id', memberId)
            .eq('attended', true)
        ).pipe(
          switchMap(({ data: attendedData }) => {
            const attendedIds = (attendedData ?? []).map((r: any) => r.movie_night_id as string);
            const unratedIds = attendedIds.filter((id) => !ratedIds.includes(id));

            if (!unratedIds.length) return of(null);

            // 3 — Most recent unrated attended movie night with movie info
            return from(
              client
                .from('movie_nights')
                .select(`
                  id, date,
                  movie:movies!movie_id(
                    id, title, release_year, poster_url, genre, director,
                    runtime, imdb_rating, imdb_url, movie_language
                  ),
                  host:members!host_id(first_name)
                `)
                .in('id', unratedIds)
                .order('date', { ascending: false })
                .limit(1)
                .single()
            ).pipe(
              map(({ data, error }) => {
                if (error || !data) return null;
                const d = data as any;
                return {
                  movieNightId: d.id,
                  date: d.date,
                  hostName: d.host?.first_name ?? 'Unknown',
                  movie: {
                    id: d.movie?.id ?? '',
                    title: d.movie?.title ?? '',
                    releaseYear: d.movie?.release_year ?? null,
                    posterUrl: d.movie?.poster_url ?? null,
                    genre: d.movie?.genre ?? null,
                    director: d.movie?.director ?? null,
                    runtime: d.movie?.runtime ?? null,
                    imdbRating: d.movie?.imdb_rating ?? null,
                    imdbUrl: d.movie?.imdb_url ?? null,
                    movieLanguage: d.movie?.movie_language ?? null,
                  },
                } as PendingRating;
              }),
              catchError(() => of(null))
            );
          })
        );
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Upsert a rating for a movie night. Safe to call multiple times (edits existing).
   */
  saveRating(payload: RatingPayload): Observable<boolean> {
    const client = this.client;
    if (!client) return of(false);

    const row: Record<string, unknown> = {
      movie_night_id: payload.movieNightId,
      member_id: payload.memberId,
      score: payload.score,
      first_watch: payload.firstWatch,
    };
    if (payload.reviewNote.trim()) row['review_note'] = payload.reviewNote.trim();
    if (payload.tags.length) row['tags'] = payload.tags;

    return from(
      client
        .from('ratings')
        .upsert(row, { onConflict: 'movie_night_id,member_id' })
    ).pipe(
      map(({ error }) => !error),
      catchError(() => of(false))
    );
  }
}
