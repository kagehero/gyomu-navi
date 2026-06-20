import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { getPool } from "./pool";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

/**
 * Bootstrap SQL for the migration ledger itself. Kept inline so we can guarantee
 * the table exists before we read from it — the chicken-and-egg of any ledger-
 * based migrator. The 003 SQL file is still applied later and is idempotent.
 */
const LEDGER_BOOTSTRAP = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function backfillLegacyIfNeeded(client: PoolClient): Promise<string[]> {
  /**
   * If a DB pre-dates the ledger (it already has a `users` table from the old
   * schema.sql/002_user_roles.sql era), mark 001 and 002 as applied so we don't
   * re-run them. Their SQL is idempotent anyway, but recording them keeps the
   * ledger honest.
   */
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
     ) AS exists`,
  );
  const usersExisted = rows[0]?.exists ?? false;
  if (!usersExisted) return [];
  return ["001_users.sql", "002_user_roles.sql"];
}

async function migrate() {
  const pool = getPool();

  await pool.query(LEDGER_BOOTSTRAP);

  const client = await pool.connect();
  try {
    const legacyBackfill = await backfillLegacyIfNeeded(client);
    for (const file of legacyBackfill) {
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
        [file],
      );
    }

    const { rows: appliedRows } = await client.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations`,
    );
    const applied = new Set(appliedRows.map((r) => r.filename));

    const files = listMigrationFiles();
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log(`No pending migrations. ${files.length} already applied.`);
      return;
    }

    console.log(`Applying ${pending.length} migration(s):`);
    for (const file of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1)`,
          [file],
        );
        await client.query("COMMIT");
        console.log(`  ✓ ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  ✗ ${file} — rolled back`);
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
