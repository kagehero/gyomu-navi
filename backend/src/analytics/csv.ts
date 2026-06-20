/** Escape a CSV field (RFC 4180). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

export function csvWithBom(rows: string[]): string {
  // UTF-8 BOM helps Excel open Japanese correctly on Windows.
  return `\uFEFF${rows.join("\r\n")}\r\n`;
}

export function csvFilename(prefix: string, from: string, to: string): string {
  const safe = `${from}_${to}`.replace(/[^\d-]/g, "");
  return `${prefix}_${safe}.csv`;
}
