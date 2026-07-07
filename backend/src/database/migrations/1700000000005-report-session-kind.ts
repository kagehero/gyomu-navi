import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds report_kind (site_total | individual) to report_sessions for the
 * leader-aggregate vs individual-record split (顧客要望: 複数人拠点). Reads the
 * source-of-truth SQL from the Phase1 migrations dir (018). Idempotent.
 */
export class ReportSessionKind1700000000005 implements MigrationInterface {
  private get migrationsDir(): string {
    return (
      process.env.PHASE1_MIGRATIONS_DIR ??
      join(__dirname, "..", "..", "..", "..", "frontend", "src", "lib", "db", "migrations")
    );
  }

  async up(qr: QueryRunner): Promise<void> {
    const sql = readFileSync(
      join(this.migrationsDir, "018_report_session_kind.sql"),
      "utf-8",
    );
    await qr.query(sql);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS idx_report_sessions_kind`);
    await qr.query(`ALTER TABLE report_sessions DROP COLUMN IF EXISTS report_kind`);
  }
}
