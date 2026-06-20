import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds the dispatch_labor_costs table (社外派遣スタッフの人件費). Reads the
 * source-of-truth SQL from the Phase1 migrations dir (017). Idempotent.
 */
export class DispatchLaborCosts1700000000004 implements MigrationInterface {
  private get migrationsDir(): string {
    return (
      process.env.PHASE1_MIGRATIONS_DIR ??
      join(__dirname, "..", "..", "..", "..", "frontend", "src", "lib", "db", "migrations")
    );
  }

  async up(qr: QueryRunner): Promise<void> {
    const sql = readFileSync(
      join(this.migrationsDir, "017_dispatch_labor_costs.sql"),
      "utf-8",
    );
    await qr.query(sql);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS dispatch_labor_costs`);
  }
}
