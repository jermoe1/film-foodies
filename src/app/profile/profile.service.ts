import { Injectable } from '@angular/core';
import { Observable, from, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../core/services/supabase.service';
import {
  HeaderStats,
  TopItem,
  ContrarianScore,
  MonthlyAvg,
  RatedMovie,
  PendingSuggestion,
} from './profile.types';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private supabase: SupabaseService) {}

  private get client() { return this.supabase.getClientOrNull(); }

  // ── Section 1: Header stats ─────────────────────────────────────────────────

  getHeaderStats(memberId: string): Observable<HeaderStats> {
    const client = this.client;
    if (!client) return of({ watched: 0, avgScore: '—', suggested: 0, hosted: 0 });

    const watched$ = from(
      client
        .from('movie_night_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', memberId)
        .eq('attended', true)
    ).pipe(
      map(({ count }) => count ?? 0),
      catchError(() => of(0))
    );

    const avgScore$ = from(
      client
        .from('ratings')
        .select('score')
        .eq('member_id', memberId)
        .not('score', 'is', null)
    ).pipe(
      map(({ data }) => {
        const rows = (data ?? []) as { score: number }[];
        if (!rows.length) return '—';
        const avg = rows.reduce((sum, r) => sum + Number(r.score), 0) / rows.length;
        return avg.toFixed(1);
      }),
      catchError(() => of('—'))
    );

    const suggested$ = from(
      client
        .from('movie_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('suggested_by', memberId)
        .is('deleted_at', null)
    ).pipe(
      map(({ count }) => count ?? 0),
      catchError(() => of(0))
    );

    const hosted$ = from(
      client
        .from('movie_nights')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', memberId)
    ).pipe(
      map(({ count }) => count ?? 0),
      catchError(() => of(0))
    );

    return forkJoin({ watched: watched$, avgScore: avgScore$, suggested: suggested$, hosted: hosted$ });
  }

  // ── Section 2: Top genres ───────────────────────────────────────────────────

  getTopGenres(memberId: string, limit = 3): Observable<TopItem[]> {
    const client = this.client;
    if (!client) return of([]);

    return from(
      client
        .from('ratings')
        .select('score, movie_nights(movies(genre))')
        .eq('member_id', memberId)
        .not('score', 'is', null)
    ).pipe(
      map(({ data }) => {
        const rows = (data ?? []) as any[];
        const tally = new Map<string, { total: number; count: number }>();

        for (const row of rows) {
          const genreStr: string = row.movie_nights?.movies?.genre ?? '';
          const score = Number(row.score);
          // OMDB returns comma-separated genres — count each independently
          for (const g of genreStr.split(', ').filter(Boolean)) {
            const prev = tally.get(g) ?? { total: 0, count: 0 };
            tally.set(g, { total: prev.total + score, count: prev.count + 1 });
          }
        }

        return [...tally.entries()]
          .map(([name, { total, count }]) => ({
            name,
            avgScore: total / count,
            filmCount: count,
          }))
          .sort((a, b) => b.filmCount - a.filmCount || b.avgScore - a.avgScore)
          .slice(0, limit);
      }),
      catchError(() => of([]))
    );
  }

  // ── Section 3: Top directors ────────────────────────────────────────────────

  getTopDirectors(memberId: string, limit = 3): Observable<TopItem[]> {
    const client = this.client;
    if (!client) return of([]);

    return from(
      client
        .from('ratings')
        .select('score, movie_nights(movies(director))')
        .eq('member_id', memberId)
        .not('score', 'is', null)
    ).pipe(
      map(({ data }) => {
        const rows = (data ?? []) as any[];
        const tally = new Map<string, { total: number; count: number }>();

        for (const row of rows) {
          const director: string = row.movie_nights?.movies?.director ?? '';
          if (!director) continue;
          const score = Number(row.score);
          const prev = tally.get(director) ?? { total: 0, count: 0 };
          tally.set(director, { total: prev.total + score, count: prev.count + 1 });
        }

        return [...tally.entries()]
          .map(([name, { total, count }]) => ({
            name,
            avgScore: total / count,
            filmCount: count,
          }))
          .sort((a, b) => b.avgScore - a.avgScore || b.filmCount - a.filmCount)
          .slice(0, limit);
      }),
      catchError(() => of([]))
    );
  }

  // ── Section 4: Top actors ───────────────────────────────────────────────────

  getTopActors(memberId: string, limit = 3): Observable<TopItem[]> {
    const client = this.client;
    if (!client) return of([]);

    return from(
      client
        .from('ratings')
        .select('score, movie_nights(movies(movie_cast))')
        .eq('member_id', memberId)
        .not('score', 'is', null)
    ).pipe(
      map(({ data }) => {
        const rows = (data ?? []) as any[];
        const tally = new Map<string, { total: number; count: number }>();

        for (const row of rows) {
          const castStr: string = row.movie_nights?.movies?.movie_cast ?? '';
          const score = Number(row.score);
          // OMDB sometimes lists many actors — cap at 4 per film
          for (const actor of castStr.split(', ').filter(Boolean).slice(0, 4)) {
            const prev = tally.get(actor) ?? { total: 0, count: 0 };
            tally.set(actor, { total: prev.total + score, count: prev.count + 1 });
          }
        }

        return [...tally.entries()]
          .map(([raw, { total, count }]) => ({
            name: this.abbreviateName(raw),
            avgScore: total / count,
            filmCount: count,
          }))
          .sort((a, b) => b.avgScore - a.avgScore || b.filmCount - a.filmCount)
          .slice(0, limit);
      }),
      catchError(() => of([]))
    );
  }

  private abbreviateName(name: string): string {
    if (name.length <= 15) return name;
    const parts = name.trim().split(' ');
    if (parts.length < 2) return name;
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }

  // ── Section 5: Contrarian score ─────────────────────────────────────────────

  getContrarianScore(memberId: string): Observable<ContrarianScore | null> {
    const client = this.client;
    if (!client) return of(null);

    // Step 1: fetch this member's ratings
    return from(
      client
        .from('ratings')
        .select('score, movie_night_id')
        .eq('member_id', memberId)
        .not('score', 'is', null)
    ).pipe(
      switchMap(({ data: myData }) => {
        const myRows = (myData ?? []) as { score: number; movie_night_id: string }[];
        if (myRows.length < 3) return of(null); // not enough data

        const nightIds = myRows.map(r => r.movie_night_id);
        const myAvg = myRows.reduce((s, r) => s + Number(r.score), 0) / myRows.length;

        // Step 2: fetch ALL ratings for those movie nights (including mine)
        return from(
          client
            .from('ratings')
            .select('score')
            .in('movie_night_id', nightIds)
            .not('score', 'is', null)
        ).pipe(
          map(({ data: groupData }) => {
            const groupRows = (groupData ?? []) as { score: number }[];
            if (!groupRows.length) return null;

            const groupAvg =
              groupRows.reduce((s, r) => s + Number(r.score), 0) / groupRows.length;
            const delta = myAvg - groupAvg;

            return {
              delta,
              label: this.contrarianLabel(delta),
              formattedDelta: (delta >= 0 ? '+' : '') + delta.toFixed(1),
            };
          }),
          catchError(() => of(null))
        );
      }),
      catchError(() => of(null))
    );
  }

  private contrarianLabel(delta: number): string {
    if (delta > 1.5)   return 'The group optimist';
    if (delta > 0.5)   return 'Slightly generous';
    if (delta >= -0.5) return 'Right on average';
    if (delta >= -1.5) return 'Slightly critical';
    return 'The group critic';
  }

  // ── Section 6: Rating trend ─────────────────────────────────────────────────

  getRatingTrend(memberId: string): Observable<MonthlyAvg[]> {
    const client = this.client;
    if (!client) return of([]);

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    const cutoffStr = cutoff.toISOString().split('T')[0]; // "YYYY-MM-DD"

    return from(
      client
        .from('ratings')
        .select('score, movie_nights(date)')
        .eq('member_id', memberId)
        .not('score', 'is', null)
    ).pipe(
      map(({ data }) => {
        const rows = (data ?? []) as any[];
        const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const tally = new Map<string, { total: number; count: number }>();

        for (const row of rows) {
          const date: string = row.movie_nights?.date ?? '';
          // Filter to last 12 months in TypeScript
          if (!date || date < cutoffStr) continue;
          const month = date.substring(0, 7); // "YYYY-MM"
          const prev = tally.get(month) ?? { total: 0, count: 0 };
          tally.set(month, { total: prev.total + Number(row.score), count: prev.count + 1 });
        }

        return [...tally.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, { total, count }]) => ({
            month,
            avgScore: total / count,
            label: MONTH_LABELS[parseInt(month.split('-')[1], 10) - 1],
          }));
      }),
      catchError(() => of([]))
    );
  }

  // ── Section 7: My ratings ───────────────────────────────────────────────────

  getMyRatings(memberId: string, limit = 6): Observable<RatedMovie[]> {
    const client = this.client;
    if (!client) return of([]);

    return from(
      client
        .from('ratings')
        .select('score, first_watch, movie_nights(date, movies(title, poster_url, release_year))')
        .eq('member_id', memberId)
        .not('score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit)
    ).pipe(
      map(({ data }) =>
        ((data ?? []) as any[]).map(r => ({
          score: Number(r.score),
          firstWatch: r.first_watch ?? null,
          date: r.movie_nights?.date ?? '',
          title: r.movie_nights?.movies?.title ?? 'Unknown',
          posterUrl: r.movie_nights?.movies?.poster_url ?? null,
          releaseYear: r.movie_nights?.movies?.release_year ?? null,
        }))
      ),
      catchError(() => of([]))
    );
  }

  // ── Section 8: My suggestions ───────────────────────────────────────────────

  getMySuggestions(memberId: string, limit = 3): Observable<PendingSuggestion[]> {
    const client = this.client;
    if (!client) return of([]);

    return from(
      client
        .from('movie_suggestions')
        .select('id, up_votes, down_votes, suggested_at, movies(title, release_year, genre, director, poster_url)')
        .eq('suggested_by', memberId)
        .is('deleted_at', null)
        .eq('status', 'pending')
        .order('suggested_at', { ascending: false })
        .limit(limit)
    ).pipe(
      map(({ data }) =>
        ((data ?? []) as any[]).map(r => ({
          id: r.id,
          upVotes: r.up_votes,
          downVotes: r.down_votes,
          suggestedAt: r.suggested_at,
          title: r.movies?.title ?? 'Unknown',
          releaseYear: r.movies?.release_year ?? null,
          genre: r.movies?.genre ?? null,
          director: r.movies?.director ?? null,
          posterUrl: r.movies?.poster_url ?? null,
        }))
      ),
      catchError(() => of([]))
    );
  }
}
