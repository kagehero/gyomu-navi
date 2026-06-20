import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds draft (一時保存) support to report_sessions. Reads the source-of-truth
 * SQL from the Phase1 migrations dir (016), consistent with the bootstrap and
 * phase2 migrations. Idempotent (`ADD COLUMN IF NOT EXISTS`).
 */
export class ReportSessionDrafts1700000000003 implements MigrationInterface {
  private get migrationsDir(): string {
    return (
      process.env.PHASE1_MIGRATIONS_DIR ??
      join(__dirname, "..", "..", "..", "..", "frontend", "src", "lib", "db", "migrations")
    );
  }

  async up(qr: QueryRunner): Promise<void> {
    const sql = readFileSync(
      join(this.migrationsDir, "016_report_session_drafts.sql"),
      "utf-8",
    );
    await qr.query(sql);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS uq_report_sessions_one_draft`);
    await qr.query(`DROP INDEX IF EXISTS idx_report_sessions_draft_staff`);
    await qr.query(`ALTER TABLE report_sessions DROP COLUMN IF EXISTS draft_payload`);
    await qr.query(`ALTER TABLE report_sessions DROP COLUMN IF EXISTS status`);
  }
}
