/**
 * Returns true if the given OMDB language string is non-English.
 * Handles multi-language values (e.g. "English, French") as non-English.
 */
export function isNonEnglish(lang: string | null): boolean {
  if (!lang) return false;
  const lower = lang.toLowerCase();
  return !lower.startsWith('english') || lower.includes(',');
}
