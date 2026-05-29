import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Concatenates and runs the Phase1 SQL migration set in order.
 *
 * This is the "lift-and-shift" bootstrap: we re-apply every migration from
 * `src/lib/db/migrations/00{1..8}_*.sql` (relative to the Phase1 monorepo
 * root) as one transactional unit. After this runs, the RDS schema is
 * identical to what Phase1 had on Neon.
 *
 * Future schema changes get their own migration class — do NOT keep
 * extending this one.
 */
export class Bootstrap1700000000001 implements MigrationInterface {
  /**
   * Path to the Phase1 monorepo migrations directory, relative to this file.
   * Override via `PHASE1_MIGRATIONS_DIR` if the backend is deployed without
   * the Phase1 sibling tree (e.g. a Docker image that ships only `backend/`).
   */
  private get migrationsDir(): string {
    return (
      process.env.PHASE1_MIGRATIONS_DIR ??
      join(__dirname, "..", "..", "..", "..", "src", "lib", "db", "migrations")
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
    for (const f of this.files) {
      const sql = readFileSync(join(this.migrationsDir, f), "utf-8");
      // queryRunner.query handles multi-statement SQL when the driver supports
      // it (pg does). We do NOT split on `;` ourselves — trigger bodies break.
      await qr.query(sql);
    }
  }

  async down(): Promise<void> {
    // See migrations/README.md — Phase1 down-migrations don't exist as a
    // single safe SQL. Use RDS PITR for rollback instead.
    throw new Error("bootstrap migration cannot be reverted automatically");
  }
}
