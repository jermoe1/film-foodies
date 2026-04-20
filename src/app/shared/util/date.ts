/**
 * Parse a YYYY-MM-DD date string as local time.
 * Using split-then-construct avoids the UTC timezone shift that
 * `new Date('YYYY-MM-DD')` would introduce on browsers west of UTC.
 */
export function parseYyyyMmDd(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}
