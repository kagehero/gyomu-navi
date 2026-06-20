import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase2 schema: applies migrations 009–015 from the Phase1 SQL set, in order.
 *
 * The NestJS service layer (business-lines, report sessions, vehicles,
 * entry-rules, employee approval, report images) already depends on these
 * tables/columns, but the original {@link Bootstrap1700000000001} only applied
 * 001–008. This migration brings the runner up to parity with the services.
 *
 * Like the bootstrap, we read the raw SQL verbatim from
 * `frontend/src/lib/db/migrations/*.sql` (source-of-truth) instead of
 * re-deriving from entity metadata — the SQL uses partial unique indexes,
 * triggers, and JSONB defaults that TypeORM's diff engine drops. Every file is
 * idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`), so re-running is
 * safe.
 *
 * Override the SQL location with `PHASE1_MIGRATIONS_DIR` when the backend is
 * deployed without the sibling frontend tree.
 */
export class Phase2SalesReporting1700000000002 implements MigrationInterface {
  private get migrationsDir(): string {
    return (
      process.env.PHASE1_MIGRATIONS_DIR ??
      join(__dirname, "..", "..", "..", "..", "frontend", "src", "lib", "db", "migrations")
    );
  }

  private readonly files = [
    "009_sales_reporting.sql",
    "010_vehicle_lists.sql",
    "011_report_sessions_multi_submit.sql",
    "012_staff_login_unique.sql",
    "013_employee_login_approval.sql",
    "014_business_type_entry_rules.sql",
    "015_report_images.sql",
  ];

  async up(qr: QueryRunner): Promise<void> {
    // As with the bootstrap: if a DB already applied 009–015 via the Phase1
    // file-ledger migrator, the tables/columns are present and the SQL is
    // idempotent (IF NOT EXISTS), but we skip to keep the run fast and to avoid
    // re-touching live data. report_images (015) is the last table in this set,
    // so its presence means the whole batch is in place.
    const rows: Array<{ t: string | null }> = await qr.query(
      `SELECT to_regclass('public.report_images') AS t`,
    );
    if (rows[0]?.t != null) {
      return;
    }
    for (const f of this.files) {
      const sql = readFileSync(join(this.migrationsDir, f), "utf-8");
      // pg handles multi-statement SQL in one query() call; do NOT split on
      // `;` ourselves — trigger bodies contain semicolons.
      await qr.query(sql);
    }
  }

  async down(): Promise<void> {
    // Additive, idempotent SQL — reverting drops shared tables and is unsafe in
    // production. Revert via PITR if ever needed (see migrations/README.md).
  }
}
