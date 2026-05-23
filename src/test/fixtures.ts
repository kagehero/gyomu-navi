/**
 * Minimal test-data factory. Each call truncates the DB and re-inserts a
 * predictable set of records. Returns the resulting IDs so individual tests
 * can reference them without having to query.
 *
 * Layout:
 *   departments  : 清掃部門 (cleaning), 警備部門 (security)
 *   client       : ABC (one client)
 *   sites        : alpha (ABC), beta (ABC)
 *   business_type: bt_clean (ABC)
 *   staffs       : sato (cleaning, assigned to alpha)
 *                  suzuki (security, assigned to beta)
 *   users        : admin@t, manager@t (cleaning), employee@t (sato)
 *
 * The fixtures cover the role-scope axis (admin/manager/employee) and the
 * cross-department isolation that most route tests need. Tests that need more
 * exotic data should insert it on top of this base.
 */
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pool";
import { ensureMigrated, truncateAll } from "./db";

export type Fixtures = {
  ids: {
    deptCleaning: string;
    deptSecurity: string;
    clientAbc: string;
    siteAlpha: string;
    siteBeta: string;
    btClean: string;
    staffSato: string;
    staffSuzuki: string;
    userAdmin: string;
    userManager: string;
    userEmployee: string;
  };
  emails: {
    admin: string;
    manager: string;
    employee: string;
  };
};

const PASSWORD = "testpass";

export async function setupFixtures(): Promise<Fixtures> {
  await ensureMigrated();
  await truncateAll();

  const pool = getPool();
  const deptCleaning = randomUUID();
  const deptSecurity = randomUUID();
  const clientAbc = randomUUID();
  const siteAlpha = randomUUID();
  const siteBeta = randomUUID();
  const btClean = randomUUID();
  const staffSato = randomUUID();
  const staffSuzuki = randomUUID();
  const userAdmin = randomUUID();
  const userManager = randomUUID();
  const userEmployee = randomUUID();

  await pool.query(
    `INSERT INTO departments (id, name) VALUES
       ($1, '清掃部門'),
       ($2, '警備部門')`,
    [deptCleaning, deptSecurity],
  );

  await pool.query(
    `INSERT INTO client_companies (id, name, code) VALUES ($1, '株式会社ABC', 'ABC')`,
    [clientAbc],
  );

  await pool.query(
    `INSERT INTO sites (id, client_id, name, latitude, longitude, radius_m) VALUES
       ($1, $3, 'Alpha 拠点', 35.689600, 139.691700, 100),
       ($2, $3, 'Beta 拠点',  35.658000, 139.701600, 100)`,
    [siteAlpha, siteBeta, clientAbc],
  );

  await pool.query(
    `INSERT INTO business_types (id, client_id, name) VALUES ($1, $2, '日常清掃')`,
    [btClean, clientAbc],
  );

  await pool.query(
    `INSERT INTO staffs (id, department_id, name, hourly_rate) VALUES
       ($1, $3, '佐藤 花子',  1200),
       ($2, $4, '鈴木 一郎',  1300)`,
    [staffSato, staffSuzuki, deptCleaning, deptSecurity],
  );

  await pool.query(
    `INSERT INTO staff_site_assigns (staff_id, site_id) VALUES
       ($1, $3),
       ($2, $4)`,
    [staffSato, staffSuzuki, siteAlpha, siteBeta],
  );

  const hash = await bcrypt.hash(PASSWORD, 4); // low cost: tests run hundreds of times
  await pool.query(
    `INSERT INTO users (id, email, password_hash, display_name, app_role, staff_id, department_id) VALUES
       ($1, 'admin@t',    $4, 'admin',    'admin',    NULL, NULL),
       ($2, 'manager@t',  $4, 'manager',  'manager',  NULL, $5),
       ($3, 'employee@t', $4, 'employee', 'employee', $6,   NULL)`,
    [userAdmin, userManager, userEmployee, hash, deptCleaning, staffSato],
  );

  return {
    ids: {
      deptCleaning,
      deptSecurity,
      clientAbc,
      siteAlpha,
      siteBeta,
      btClean,
      staffSato,
      staffSuzuki,
      userAdmin,
      userManager,
      userEmployee,
    },
    emails: { admin: "admin@t", manager: "manager@t", employee: "employee@t" },
  };
}

export const TEST_PASSWORD = PASSWORD;
