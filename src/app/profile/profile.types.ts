// ── Film Foodies — Profile Page Types ─────────────────────────────────────────
// All interfaces used by ProfileService and ProfileModule sub-components.

export interface HeaderStats {
  watched: number;
  avgScore: string;   // formatted "##.#" or "—" if no ratings
  suggested: number;
  hosted: number;
}

/** Shared shape for genre, director, and actor top-3 rows. */
export interface TopItem {
  name: string;
  avgScore: number;
  filmCount: number;
}

export interface ContrarianScore {
  delta: number;
  label: string;         // e.g. "Slightly generous"
  formattedDelta: string; // e.g. "+0.8" or "-1.2"
}

export interface MonthlyAvg {
  month: string;     // "YYYY-MM"
  avgScore: number;
  label: string;     // "Jan", "Feb", etc.
}

export interface RatedMovie {
  score: number;
  firstWatch: boolean | null;
  date: string;
  title: string;
  posterUrl: string | null;
  releaseYear: string | null;
}

export interface PendingSuggestion {
  id: string;
  upVotes: number;
  downVotes: number;
  suggestedAt: string;
  title: string;
  releaseYear: string | null;
  genre: string | null;
  director: string | null;
  posterUrl: string | null;
}
