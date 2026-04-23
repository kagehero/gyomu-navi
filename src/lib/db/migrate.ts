import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./pool";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const pool = getPool();
  const files = ["schema.sql", "002_user_roles.sql"];
  for (const file of files) {
    const sql = readFileSync(join(__dirname, file), "utf-8");
    await pool.query(sql);
    console.log("Migration applied:", file);
  }
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
