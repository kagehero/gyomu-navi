import "dotenv/config";
import bcrypt from "bcrypt";
import { getPool } from "./pool";

const SALT = 10;
const DEFAULT_PASSWORD = "changeme123";

async function seed() {
  const pool = getPool();
  const adminHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT);
  const emHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT);

  await pool.query(
    `INSERT INTO users (email, password_hash, display_name, app_role, staff_profile_id)
     VALUES ($1, $2, '管理者', 'admin', NULL)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       display_name = EXCLUDED.display_name,
       app_role = 'admin',
       staff_profile_id = NULL`,
    ["admin@example.com", adminHash],
  );
  console.log("Seed admin: admin@example.com / " + DEFAULT_PASSWORD);

  await pool.query(
    `INSERT INTO users (email, password_hash, display_name, app_role, staff_profile_id)
     VALUES ($1, $2, '佐藤 花子', 'employee', 'st2')
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       display_name = EXCLUDED.display_name,
       app_role = 'employee',
       staff_profile_id = 'st2'`,
    ["employee@example.com", emHash],
  );
  console.log("Seed employee: employee@example.com / " + DEFAULT_PASSWORD + "  (st2: 新宿パークタワー)");

  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
