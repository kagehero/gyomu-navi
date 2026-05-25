/**
 * Test DB helpers. Imports getPool from the production pool module — by this
 * point integration-setup.ts has already rewritten DATABASE_URL to point at
 * the test database, so the pool connects there.
 *
 * The schema is brought up by running the same migrations the app uses, so we
 * never drift between test and dev.
 */
import { execSync } from "node:child_process";
import { getPool } from "@/lib/db/pool";

let migrated = false;

/**
 * Run the migration ledger against the test DB. Idempotent — invoking twice
 * in the same process is a no-op after the first migrate completes.
 *
 * We shell out to `npx tsx src/lib/db/migrate.ts` instead of importing it so
 * the migration runner uses its own pool with its own DATABASE_URL read at
 * startup. This guarantees migrations always target the same DB the tests do.
 */
export async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  execSync("npx tsx src/lib/db/migrate.ts", {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: "ignore",
  });
  migrated = true;
}

/**
 * Truncate all data tables, leaving schema_migrations intact. Used between
 * test files (or describe blocks) to start from a known empty state.
 */
export async function truncateAll(): Promise<void> {
  await getPool().query(`
    TRUNCATE
      vehicle_visits,
      vehicles,
      vehicle_lists,
      board_posts,
      notice_reads,
      notices,
      business_reports,
      report_sessions,
      attendance_logs,
      staff_client_assigns,
      staff_business_line_assigns,
      client_business_lines,
      staff_site_assigns,
      staffs,
      business_types,
      sites,
      client_companies,
      business_lines,
      departments,
      users
    RESTART IDENTITY CASCADE
  `);
}

/** Look up a user id by email, used to forge auth cookies after seeding. */
export async function getUserIdByEmail(email: string): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [email],
  );
  const row = rows[0];
  if (!row) throw new Error(`test: user ${email} not found in DB`);
  return row.id;
}

/** Convenience: close the shared pool after all tests in a file. */
export async function closePool(): Promise<void> {
  await getPool().end();
}
