/**
 * Compute the JST calendar date for a given UTC instant (default: now).
 * Returns a YYYY-MM-DD string suitable for the work_date DATE column.
 */
export function jstWorkDate(at: Date = new Date()): string {
  // Add the JST offset (+09:00) then read the ISO date portion in UTC.
  const ms = at.getTime() + 9 * 3600_000;
  return new Date(ms).toISOString().slice(0, 10);
}
