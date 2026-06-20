/**
 * Compute the JST calendar date for a given UTC instant (default: now).
 * Returns a YYYY-MM-DD string suitable for the work_date DATE column.
 */
export function jstWorkDate(at: Date = new Date()): string {
  const ms = at.getTime() + 9 * 3600_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's calendar date in JST (YYYY-MM-DD). */
export function todayJST(): string {
  return jstWorkDate();
}

/** JST calendar date N days before now (or before `anchor`). */
export function jstDateNDaysAgo(n: number, anchor: Date = new Date()): string {
  return jstWorkDate(new Date(anchor.getTime() - n * 86_400_000));
}

const JP_DATE_FMT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

const JP_DATE_SHORT_FMT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "long",
  day: "numeric",
  weekday: "short",
});

const JP_DATETIME_FMT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const JP_TIME_FMT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
});

/** "2026年6月1日(月)" */
export function formatJPDate(input: string | Date): string {
  return JP_DATE_FMT.format(new Date(input));
}

/** "6月1日(月)" */
export function formatJPDateShort(input: string | Date): string {
  return JP_DATE_SHORT_FMT.format(new Date(input));
}

/** "2026/06/01 09:30" */
export function formatJPDateTime(input: string | Date): string {
  return JP_DATETIME_FMT.format(new Date(input));
}

/** "09:30" (returns "—" for null/invalid) */
export function formatJPTime(input: string | null | undefined): string {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return JP_TIME_FMT.format(d);
}

/** Relative label for known recent dates: 今日 / 昨日, otherwise short JP date. */
export function formatRelativeJPDate(workDate: string, anchor: string = todayJST()): string {
  if (workDate === anchor) return "今日";
  if (workDate === jstDateNDaysAgo(1, new Date(`${anchor}T00:00:00+09:00`))) return "昨日";
  return formatJPDateShort(workDate);
}
