import { types } from "pg";

/**
 * Coerce Postgres numeric-ish types to JS `number` globally.
 *
 * node-postgres returns `numeric`, `float8`, and `int8` as **strings** by
 * default (to preserve precision beyond JS `number`). TypeORM raw queries
 * (`DataSource.query`) surface those strings verbatim, so a column like
 * `(r.count * bt.unit_price_incl)::float8` arrives as `"1234.00"`. Client
 * code that does `sum + value` then string-concatenates instead of adding —
 * e.g. the reports "台数合計" / "税込売上" totals.
 *
 * The values in this app (counts, JPY amounts, lat/long) stay well within
 * `Number.MAX_SAFE_INTEGER`, so parsing to `number` is safe here.
 *
 * NOTE: DATE (oid 1082) is intentionally NOT parsed — the SQL already casts
 * date columns with `::text` (e.g. `work_date::text`) to keep them as raw
 * `YYYY-MM-DD` strings anchored to JST, matching Phase1 behavior.
 *
 * Call once at process start (before any DB connection is opened).
 */
export function registerPgTypeParsers(): void {
  const FLOAT8 = 701;
  const NUMERIC = 1700;
  const INT8 = 20;

  types.setTypeParser(FLOAT8, (v) => (v === null ? null : Number.parseFloat(v)));
  types.setTypeParser(NUMERIC, (v) => (v === null ? null : Number.parseFloat(v)));
  types.setTypeParser(INT8, (v) => (v === null ? null : Number.parseInt(v, 10)));
}
