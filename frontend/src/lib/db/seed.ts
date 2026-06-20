import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { getPool } from "./pool";

const SALT = 10;
const ADMIN_PASSWORD = "changeme123";

/**
 * Creates admin/manager demo users. Employees register at /register and await admin approval.
 * Run after: npm run db:migrate && npm run db:import-sales
 */
async function seed() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: deptRows } = await client.query<{ id: string }>(
      `SELECT id FROM departments WHERE deleted_at IS NULL ORDER BY name LIMIT 1`,
    );
    const deptId = deptRows[0]?.id;
    if (!deptId) throw new Error("No department found — run db:import-sales first");

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT);
    const adminId = randomUUID();
    const managerId = randomUUID();

    await client.query(`DELETE FROM users WHERE email = ANY($1::text[])`, [
      ["admin@example.com", "manager@example.com", "employee@example.com"],
    ]);

    await client.query(
      `INSERT INTO users (id, email, password_hash, display_name, app_role, staff_id, department_id)
       VALUES
         ($1, 'admin@example.com',   $3, '管理者',       'admin',   NULL, NULL),
         ($2, 'manager@example.com', $3, '部門マネージャ', 'manager', NULL, $4)`,
      [adminId, managerId, passwordHash, deptId],
    );

    await client.query("COMMIT");
    console.log("Seed complete.");
    console.log(`  admin   : admin@example.com   / ${ADMIN_PASSWORD}`);
    console.log(`  manager : manager@example.com / ${ADMIN_PASSWORD}`);
    console.log("  employee: /register からログイン情報を登録 → 管理者がマスタ管理で承認");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
