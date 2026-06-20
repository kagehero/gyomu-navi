import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Concatenates and runs the Phase1 SQL migration set in order.
 *
 * This is the "lift-and-shift" bootstrap: we re-apply every migration from
 * `frontend/src/lib/db/migrations/00{1..8}_*.sql` (relative to the monorepo
 * root) as one transactional unit. After this runs, the RDS schema is
 * identical to what Phase1 had on Neon.
 *
 * Future schema changes get their own migration class — do NOT keep
 * extending this one.
 */
export class Bootstrap1700000000001 implements MigrationInterface {
  /**
   * Path to the Phase1 SQL migrations, lifted from `frontend/src/lib/db/migrations`.
   * Override via `PHASE1_MIGRATIONS_DIR` if the backend is deployed without
   * the sibling frontend tree (e.g. a Docker image that ships only `backend/`).
   *
   * Path is computed from this file's location:
   *   backend/src/database/migrations/ → ../../../../frontend/src/lib/db/migrations
   */
  private get migrationsDir(): string {
    return (
      process.env.PHASE1_MIGRATIONS_DIR ??
      join(__dirname, "..", "..", "..", "..", "frontend", "src", "lib", "db", "migrations")
    );
  }

  private readonly files = [
    "001_users.sql",
    "002_user_roles.sql",
    "003_migration_tracking.sql",
    "004_master_data.sql",
    "005_users_link_to_staff.sql",
    "006_attendance.sql",
    "007_business_reports.sql",
    "008_notices.sql",
  ];

  async up(qr: QueryRunner): Promise<void> {
    // Some deployments already applied 001–008 through the Phase1 file-ledger
    // migrator (frontend `db:migrate`, tracked in `schema_migrations`). On those
    // DBs re-running this DDL is at best redundant and at worst fails — the
    // CREATE UNIQUE INDEX statements aren't guarded by IF NOT EXISTS against
    // pre-existing *data* that legitimately violates an early, since-superseded
    // constraint. If the schema is already present, record this migration as
    // applied without re-running it.
    if (await this.alreadyApplied(qr)) {
      return;
    }
    for (const f of this.files) {
      const sql = readFileSync(join(this.migrationsDir, f), "utf-8");
      // queryRunner.query handles multi-statement SQL when the driver supports
      // it (pg does). We do NOT split on `;` ourselves — trigger bodies break.
      await qr.query(sql);
    }
  }

  /** True if 001–008 schema is already in place (sentinel: notices table). */
  private async alreadyApplied(qr: QueryRunner): Promise<boolean> {
    const rows: Array<{ t: string | null }> = await qr.query(
      `SELECT to_regclass('public.notices') AS t`,
    );
    return rows[0]?.t != null;
  }

  async down(): Promise<void> {
    // See migrations/README.md — Phase1 down-migrations don't exist as a
    // single safe SQL. Use RDS PITR for rollback instead.
    throw new Error("bootstrap migration cannot be reverted automatically");
  }
}
