/**
 * Returns a CSS color string for a 0–10 film score.
 * Green ≥ 7.5, Gold ≥ 5.0, Red < 5.0.
 */
export function scoreColor(score: number): string {
  if (score >= 7.5) return '#4a9a5a';
  if (score >= 5.0) return '#d4a03a';
  return '#c04040';
}
