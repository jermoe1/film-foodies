import { Injectable } from '@angular/core';
import { Observable, from, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from '../core/services/supabase.service';

// ── Raw data types ────────────────────────────────────────────────────────────

interface StatsMember {
  id: string;
  firstName: string;
  avatarColor: string;
}

interface StatsNight {
  id: string;
  date: string;
  movieTitle: string;
  posterUrl: string | null;
  imdbRating: number | null;
  genre: string | null;
}

interface StatsRating {
  movieNightId: string;
  memberId: string;
  score: number | null;
  firstWatch: boolean | null;
}

// ── Computed types (exported for component use) ───────────────────────────────

export interface MemberScore {
  memberId: string;
  firstName: string;
  avatarColor: string;
  score: number | null;
}

export interface NightStat {
  nightId: string;
  movieTitle: string;
  posterUrl: string | null;
  imdbRating: number | null;
  avgScore: number;
  stdDev: number;
  imdbDelta: number | null;
  memberScores: MemberScore[];
}

export interface MemberAvg {
  memberId: string;
  firstName: string;
  avatarColor: string;
  avgScore: number | null;
  ratingCount: number;
  avgDeviation: number | null;
}

export interface GenreStat {
  genre: string;
  count: number;
}

export interface StatsResult {
  totalNights: number;
  totalMembers: number;
  groupAvg: number | null;
  firstWatchAvg: number | null;
  rewatchAvg: number | null;
  memberAvgs: MemberAvg[];
  splitTheRoom: NightStat[];
  consensus: NightStat | null;
  contrarian: MemberAvg | null;
  biggestSurprise: NightStat | null;
  mostOverhyped: NightStat | null;
  topFilms: NightStat[];
  genres: GenreStat[];
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class StatsService {
  constructor(private supabase: SupabaseService) {}

  private get client() {
    try { return this.supabase.getClient(); } catch { return null; }
  }

  getStats(): Observable<StatsResult | null> {
    const client = this.client;
    if (!client) return of(null);

    const members$ = from(
      client.from('members').select('id, first_name, avatar_color').order('display_order')
    ).pipe(map(({ data }) => (data ?? []) as any[]));

    const nights$ = from(
      client
        .from('movie_nights')
        .select(`
          id, date,
          movie:movies!movie_id(id, title, poster_url, imdb_rating, genre)
        `)
        .order('date', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []) as any[]));

    const ratings$ = from(
      client.from('ratings').select('movie_night_id, member_id, score, first_watch')
    ).pipe(map(({ data }) => (data ?? []) as any[]));

    return forkJoin([members$, nights$, ratings$]).pipe(
      map(([membersRaw, nightsRaw, ratingsRaw]) => {
        const members: StatsMember[] = membersRaw.map((m: any) => ({
          id: m.id,
          firstName: m.first_name,
          avatarColor: m.avatar_color,
        }));

        const nights: StatsNight[] = nightsRaw.map((n: any) => ({
          id: n.id,
          date: n.date,
          movieTitle: n.movie?.title ?? '',
          posterUrl: n.movie?.poster_url ?? null,
          imdbRating: n.movie?.imdb_rating ? parseFloat(n.movie.imdb_rating) : null,
          genre: n.movie?.genre ?? null,
        }));

        const ratings: StatsRating[] = ratingsRaw.map((r: any) => ({
          movieNightId: r.movie_night_id,
          memberId: r.member_id,
          score: r.score !== null ? parseFloat(r.score) : null,
          firstWatch: r.first_watch,
        }));

        return this.compute(members, nights, ratings);
      }),
      catchError(() => of(null))
    );
  }

  private compute(
    members: StatsMember[],
    nights: StatsNight[],
    ratings: StatsRating[]
  ): StatsResult {
    // ── Per-night stats ───────────────────────────────────────────────────────
    const nightStats: NightStat[] = nights.map((night) => {
      const nightRatings = ratings.filter((r) => r.movieNightId === night.id);
      const scores = nightRatings.filter((r) => r.score !== null).map((r) => r.score as number);
      const avg = scores.length
        ? round1(scores.reduce((s, v) => s + v, 0) / scores.length)
        : 0;
      const sd = round2(stdDev(scores));
      const imdbDelta =
        night.imdbRating !== null && scores.length >= 2
          ? round1(avg - night.imdbRating)
          : null;

      const memberScores: MemberScore[] = members.map((m) => {
        const r = nightRatings.find((r) => r.memberId === m.id);
        return {
          memberId: m.id,
          firstName: m.firstName,
          avatarColor: m.avatarColor,
          score: r?.score ?? null,
        };
      });

      return {
        nightId: night.id,
        movieTitle: night.movieTitle,
        posterUrl: night.posterUrl,
        imdbRating: night.imdbRating,
        avgScore: avg,
        stdDev: sd,
        imdbDelta,
        memberScores,
      };
    });

    const ratedNights = nightStats.filter(
      (n) => n.memberScores.filter((s) => s.score !== null).length >= 2
    );

    // ── Summary ───────────────────────────────────────────────────────────────
    const allScores = ratings.filter((r) => r.score !== null).map((r) => r.score as number);
    const groupAvg = allScores.length
      ? round1(allScores.reduce((s, v) => s + v, 0) / allScores.length)
      : null;

    const fwScores = ratings.filter((r) => r.score !== null && r.firstWatch === true).map((r) => r.score as number);
    const rwScores = ratings.filter((r) => r.score !== null && r.firstWatch === false).map((r) => r.score as number);
    const firstWatchAvg = fwScores.length
      ? round1(fwScores.reduce((s, v) => s + v, 0) / fwScores.length)
      : null;
    const rewatchAvg = rwScores.length
      ? round1(rwScores.reduce((s, v) => s + v, 0) / rwScores.length)
      : null;

    // ── Member averages ───────────────────────────────────────────────────────
    const memberAvgs: MemberAvg[] = members
      .map((m) => {
        const memberRatings = ratings.filter((r) => r.memberId === m.id && r.score !== null);
        const scores = memberRatings.map((r) => r.score as number);
        const avg = scores.length
          ? round1(scores.reduce((s, v) => s + v, 0) / scores.length)
          : null;

        // Avg deviation from that night's group average
        const deviations = memberRatings
          .map((r) => {
            const ns = nightStats.find((n) => n.nightId === r.movieNightId);
            return ns ? Math.abs((r.score as number) - ns.avgScore) : null;
          })
          .filter((d): d is number => d !== null);

        const avgDeviation =
          deviations.length >= 3
            ? round2(deviations.reduce((s, v) => s + v, 0) / deviations.length)
            : null;

        return {
          memberId: m.id,
          firstName: m.firstName,
          avatarColor: m.avatarColor,
          avgScore: avg,
          ratingCount: scores.length,
          avgDeviation,
        };
      })
      .filter((m) => m.ratingCount > 0)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));

    // ── Split the Room (top 3 by stdDev, ≥3 raters) ───────────────────────────
    const splitTheRoom = [...ratedNights]
      .filter((n) => n.memberScores.filter((s) => s.score !== null).length >= 3)
      .sort((a, b) => b.stdDev - a.stdDev)
      .slice(0, 3);

    // ── Perfect Consensus (lowest stdDev, ≥3 raters) ─────────────────────────
    const consensusCandidates = [...ratedNights]
      .filter((n) => n.memberScores.filter((s) => s.score !== null).length >= 3)
      .sort((a, b) => a.stdDev - b.stdDev);
    const consensus = consensusCandidates[0] ?? null;

    // ── Contrarian (highest avg deviation, ≥5 ratings) ───────────────────────
    const contrarian =
      memberAvgs
        .filter((m) => m.avgDeviation !== null && m.ratingCount >= 5)
        .sort((a, b) => (b.avgDeviation ?? 0) - (a.avgDeviation ?? 0))[0] ?? null;

    // ── Surprise / Overhyped ──────────────────────────────────────────────────
    const deltaRated = ratedNights.filter((n) => n.imdbDelta !== null);
    const sortedByDelta = [...deltaRated].sort(
      (a, b) => (b.imdbDelta ?? 0) - (a.imdbDelta ?? 0)
    );
    const biggestSurprise =
      sortedByDelta.length && sortedByDelta[0].imdbDelta! > 0 ? sortedByDelta[0] : null;
    const lastDelta = sortedByDelta[sortedByDelta.length - 1];
    const mostOverhyped =
      sortedByDelta.length > 1 && lastDelta?.imdbDelta! < 0 ? lastDelta : null;

    // ── Top films (top 5 by avgScore, ≥2 raters) ─────────────────────────────
    const topFilms = [...ratedNights]
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);

    // ── Genre breakdown ───────────────────────────────────────────────────────
    const genreCount = new Map<string, number>();
    for (const night of nights) {
      if (!night.genre) continue;
      for (const g of night.genre.split(', ')) {
        genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
      }
    }
    const genres: GenreStat[] = Array.from(genreCount.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      totalNights: nights.length,
      totalMembers: members.length,
      groupAvg,
      firstWatchAvg,
      rewatchAvg,
      memberAvgs,
      splitTheRoom,
      consensus,
      contrarian,
      biggestSurprise,
      mostOverhyped,
      topFilms,
      genres,
    };
  }
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
