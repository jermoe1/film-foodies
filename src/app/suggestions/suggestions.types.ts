// ── Film Foodies — Suggestions Module Types ────────────────────────────────────

export interface ContentWarning {
  warning: string;
  severity: 'mild' | 'moderate' | 'severe';
  source: string;
  source_url: string;
}

export interface SuggestionMovie {
  id: string;
  title: string;
  releaseYear: number | null;
  posterUrl: string | null;
  genre: string | null;
  director: string | null;
  runtime: string | null;
  imdbRating: string | null;
  imdbUrl: string | null;
  movieLanguage: string | null;
  contentWarnings: ContentWarning[] | null;
}

export interface SuggestionCard {
  id: string;
  suggestedAt: string;
  suggestedByName: string;
  suggestedById: string;
  manualWarnings: string[];
  movie: SuggestionMovie;
  upVotes: number;
  downVotes: number;
  myVote: 'up' | 'down' | null;
}

export type SortOption = 'oldest' | 'newest' | 'top' | 'az';

/** A movie candidate shown in the search results when suggesting. */
export interface MovieSearchResult {
  /** null if the movie is not yet in the movies table */
  id: string | null;
  imdbId: string;
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
  /** true when the row came from the local movies table */
  inDb: boolean;
}
