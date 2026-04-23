/**
 * DB pool for API routes and CLI (`db:migrate` / `db:seed` via tsx).
 * Intentionally not using `server-only` so migrate/seed scripts can import this module outside Next.js.
 */
import pg from "pg";

const { Pool } = pg;

let _pool: pg.Pool | null = null;

function createPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required (e.g. postgresql://user:pass@localhost:5432/gyomu_navi)",
    );
  }
  const connectionString = process.env.DATABASE_URL;
  const useSsl =
    process.env.DATABASE_SSL === "true" ||
    /neon\.tech|sslmode=require|aiven\.io|supabase\.co|rds\.amazonaws\.com/i.test(
      connectionString,
    );
  return new Pool({
    connectionString,
    max: 10,
    ...(useSsl ? { ssl: { rejectUnauthorized: true } } : {}),
  });
}

export function getPool(): pg.Pool {
  if (!_pool) _pool = createPool();
  return _pool;
}
