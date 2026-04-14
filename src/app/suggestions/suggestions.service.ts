import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from '../core/services/supabase.service';
import { SuggestionCard, SortOption } from './suggestions.types';

@Injectable({ providedIn: 'root' })
export class SuggestionsService {
  constructor(private supabase: SupabaseService) {}

  private get client() {
    try { return this.supabase.getClient(); } catch { return null; }
  }

  /**
   * Fetch all pending (non-deleted) suggestions, joined with movie data,
   * suggester name, and vote counts.
   * Sorting is applied in-memory so all sort options share one query.
   */
  getQueue(memberId: string, sort: SortOption): Observable<SuggestionCard[]> {
    const client = this.client;
    if (!client) return of([]);

    return from(
      client
        .from('movie_suggestions')
        .select(`
          id, suggested_at, manual_warnings, suggested_by,
          movie:movies!movie_id(
            id, title, release_year, poster_url, genre, director,
            runtime, imdb_rating, imdb_url, movie_language, content_warnings
          ),
          suggester:members!suggested_by(first_name),
          suggestion_votes(member_id, vote)
        `)
        .is('deleted_at', null)
        .eq('status', 'pending')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        const rows = (data ?? []) as any[];
        const cards: SuggestionCard[] = rows.map((r) => {
          const votes: { member_id: string; vote: string }[] = r.suggestion_votes ?? [];
          return {
            id: r.id,
            suggestedAt: r.suggested_at,
            suggestedByName: r.suggester?.first_name ?? 'Unknown',
            suggestedById: r.suggested_by,
            manualWarnings: r.manual_warnings ?? [],
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
              contentWarnings: r.movie?.content_warnings ?? null,
            },
            upVotes: votes.filter((v) => v.vote === 'up').length,
            downVotes: votes.filter((v) => v.vote === 'down').length,
            myVote: (votes.find((v) => v.member_id === memberId)?.vote as 'up' | 'down') ?? null,
          };
        });
        return this.sortCards(cards, sort);
      }),
      catchError(() => of([]))
    );
  }

  private sortCards(cards: SuggestionCard[], sort: SortOption): SuggestionCard[] {
    switch (sort) {
      case 'oldest':
        return [...cards].sort((a, b) => a.suggestedAt.localeCompare(b.suggestedAt));
      case 'newest':
        return [...cards].sort((a, b) => b.suggestedAt.localeCompare(a.suggestedAt));
      case 'top':
        return [...cards].sort((a, b) => (b.upVotes - b.downVotes) - (a.upVotes - a.downVotes));
      case 'az':
        return [...cards].sort((a, b) => a.movie.title.localeCompare(b.movie.title));
    }
  }

  /**
   * Cast or change a vote. If the member already voted the same way, remove the vote.
   * Returns the new myVote state.
   */
  vote(suggestionId: string, memberId: string, voteDir: 'up' | 'down', currentVote: 'up' | 'down' | null): Observable<void> {
    const client = this.client;
    if (!client) return of(undefined);

    if (currentVote === voteDir) {
      // Toggle off — remove vote
      return from(
        client
          .from('suggestion_votes')
          .delete()
          .eq('suggestion_id', suggestionId)
          .eq('member_id', memberId)
      ).pipe(map(() => undefined), catchError(() => of(undefined)));
    }

    // Upsert (insert or update)
    return from(
      client
        .from('suggestion_votes')
        .upsert(
          { suggestion_id: suggestionId, member_id: memberId, vote: voteDir },
          { onConflict: 'suggestion_id,member_id' }
        )
    ).pipe(map(() => undefined), catchError(() => of(undefined)));
  }

  /**
   * Soft-delete a suggestion by setting deleted_at to now().
   * The caller is responsible for the 5-second timer deferral.
   */
  softDelete(id: string): Observable<void> {
    const client = this.client;
    if (!client) return of(undefined);
    return from(
      client
        .from('movie_suggestions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
    ).pipe(map(() => undefined), catchError(() => of(undefined)));
  }

  /**
   * Add a new suggestion. Returns the new suggestion id on success, null on failure.
   */
  addSuggestion(
    movieId: string,
    memberId: string,
    manualWarnings: string[]
  ): Observable<string | null> {
    const client = this.client;
    if (!client) return of(null);
    return from(
      client
        .from('movie_suggestions')
        .insert({
          movie_id: movieId,
          suggested_by: memberId,
          status: 'pending',
          manual_warnings: manualWarnings.length ? manualWarnings : null,
        })
        .select('id')
        .single()
    ).pipe(
      map(({ data }) => (data as any)?.id ?? null),
      catchError(() => of(null))
    );
  }
}
