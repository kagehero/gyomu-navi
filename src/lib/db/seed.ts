import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import {
  attendanceLogs,
  boardPosts,
  businessReports,
  businessTypes,
  clientCompanies,
  departments,
  notices,
  sites,
  staffs,
} from "./seed_data";
import { getPool } from "./pool";

/**
 * Dev seed. Wipes the data tables (NOT schema_migrations) and reinserts the
 * mockData contents using freshly minted UUIDs, then creates three demo users:
 *
 *   admin@example.com    / changeme123  -> app_role='admin'
 *   manager@example.com  / changeme123  -> app_role='manager', department=清掃部門
 *   employee@example.com / changeme123  -> app_role='employee', staff=佐藤 花子
 *
 * Designed to be idempotent: running it twice produces the same result (with
 * fresh UUIDs, but the same logical content).
 */

const SALT = 10;
const DEFAULT_PASSWORD = "changeme123";

/** Map a mockData attendance status to the new enum. */
function mapAttendanceStatus(s: string): "working" | "done" | "absent" {
  if (s === "出勤中") return "working";
  if (s === "退勤済") return "done";
  if (s === "遅刻") return "done"; // Phase 1: no late detection
  return "absent";
}

/** Combine mockData `date` + `HH:MM` into a JST TIMESTAMPTZ (ISO string). */
function jstTimestamp(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00+09:00`;
}

async function seed() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ---------- wipe data tables (keep schema_migrations) ---------- */
    await client.query(`
      TRUNCATE
        board_posts,
        notice_reads,
        notices,
        business_reports,
        attendance_logs,
        staff_site_assigns,
        staffs,
        business_types,
        sites,
        client_companies,
        departments,
        users
      RESTART IDENTITY CASCADE
    `);

    /* ---------- departments ---------- */
    const deptIdByMock = new Map<string, string>();
    for (const d of departments) {
      const id = randomUUID();
      deptIdByMock.set(d.id, id);
      await client.query(
        `INSERT INTO departments (id, name) VALUES ($1, $2)`,
        [id, d.name],
      );
    }

    /* ---------- client_companies ---------- */
    const clientIdByMock = new Map<string, string>();
    for (const c of clientCompanies) {
      const id = randomUUID();
      clientIdByMock.set(c.id, id);
      await client.query(
        `INSERT INTO client_companies (id, name, code) VALUES ($1, $2, $3)`,
        [id, c.name, c.code],
      );
    }

    /* ---------- sites ---------- */
    const siteIdByMock = new Map<string, string>();
    for (const s of sites) {
      const id = randomUUID();
      siteIdByMock.set(s.id, id);
      await client.query(
        `INSERT INTO sites (id, client_id, name, latitude, longitude, radius_m)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          clientIdByMock.get(s.clientId)!,
          s.name,
          s.latitude,
          s.longitude,
          s.radiusM,
        ],
      );
    }

    /* ---------- business_types ---------- */
    const btIdByMock = new Map<string, string>();
    for (const b of businessTypes) {
      const id = randomUUID();
      btIdByMock.set(b.id, id);
      await client.query(
        `INSERT INTO business_types (id, client_id, name) VALUES ($1, $2, $3)`,
        [id, clientIdByMock.get(b.clientId)!, b.name],
      );
    }

    /* ---------- staffs + staff_site_assigns ---------- */
    const staffIdByMock = new Map<string, string>();
    for (const s of staffs) {
      const id = randomUUID();
      staffIdByMock.set(s.id, id);
      await client.query(
        `INSERT INTO staffs (id, department_id, name, hourly_rate)
         VALUES ($1, $2, $3, $4)`,
        [id, deptIdByMock.get(s.departmentId)!, s.name, s.hourlyRate],
      );
      for (const mockSiteId of s.siteIds) {
        await client.query(
          `INSERT INTO staff_site_assigns (staff_id, site_id) VALUES ($1, $2)`,
          [id, siteIdByMock.get(mockSiteId)!],
        );
      }
    }

    /* ---------- users ---------- */
    const adminId = randomUUID();
    const managerId = randomUUID();
    const employeeId = randomUUID();
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT);
    const cleaningDeptId = deptIdByMock.get("d1");
    const sato = staffIdByMock.get("st2");
    if (!cleaningDeptId) throw new Error("seed: missing 清掃部門 (d1)");
    if (!sato) throw new Error("seed: missing 佐藤花子 (st2)");

    await client.query(
      `INSERT INTO users (id, email, password_hash, display_name, app_role, staff_id, department_id)
       VALUES
         ($1, 'admin@example.com',    $4, '管理者',    'admin',    NULL, NULL),
         ($2, 'manager@example.com',  $4, '部門マネージャ', 'manager',  NULL, $5),
         ($3, 'employee@example.com', $4, '佐藤 花子', 'employee', $6,   NULL)`,
      [adminId, managerId, employeeId, passwordHash, cleaningDeptId, sato],
    );

    /* ---------- attendance_logs ---------- */
    for (const a of attendanceLogs) {
      if (a.status === "未出勤") continue; // skip rows with synthetic 00:00 punch
      await client.query(
        `INSERT INTO attendance_logs
           (staff_id, site_id, work_date, punch_in_at, punch_out_at, status,
            punch_in_lat, punch_in_lng)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          staffIdByMock.get(a.staffId)!,
          siteIdByMock.get(a.siteId)!,
          a.date,
          jstTimestamp(a.date, a.punchIn),
          a.punchOut ? jstTimestamp(a.date, a.punchOut) : null,
          mapAttendanceStatus(a.status),
          a.lat || null,
          a.lng || null,
        ],
      );
    }

    /* ---------- business_reports ---------- */
    for (const r of businessReports) {
      await client.query(
        `INSERT INTO business_reports
           (staff_id, site_id, client_id, business_type_id, count, memo, reported_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          staffIdByMock.get(r.staffId)!,
          siteIdByMock.get(r.siteId)!,
          clientIdByMock.get(r.clientId)!,
          btIdByMock.get(r.businessTypeId)!,
          r.count,
          r.memo ?? null,
          // mockData stores naive local timestamps; treat as JST.
          r.reportedAt.includes("+") ? r.reportedAt : `${r.reportedAt}+09:00`,
        ],
      );
    }

    /* ---------- notices ----------
     * mockData has `fromStaffId` (a Staff id). We need a users.id for from_user_id.
     * For the seed we attribute every notice to the admin user.
     * target_user_id mockData uses Staff id "stN" — map "st2" -> employeeId; others ignored.
     */
    for (const n of notices) {
      const targetUserId =
        n.targetType === "individual" && n.targetId === "st2" ? employeeId : null;
      const targetDeptId =
        n.targetType === "department" && n.targetId
          ? (deptIdByMock.get(n.targetId) ?? null)
          : null;

      // Skip rows we can't map cleanly (e.g. individual target other than st2).
      if (n.targetType === "individual" && targetUserId === null) continue;
      if (n.targetType === "department" && targetDeptId === null) continue;

      await client.query(
        `INSERT INTO notices
           (from_user_id, target_type, target_department_id, target_user_id,
            client_id, title, body, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          adminId,
          n.targetType,
          targetDeptId,
          targetUserId,
          n.clientId ? (clientIdByMock.get(n.clientId) ?? null) : null,
          n.title,
          n.body,
          `${n.createdAt}+09:00`,
        ],
      );
    }

    /* ---------- board_posts ---------- */
    for (const p of boardPosts) {
      await client.query(
        `INSERT INTO board_posts
           (site_id, author_user_id, title, body, pinned, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          siteIdByMock.get(p.siteId)!,
          adminId,
          p.title,
          p.body,
          p.pinned,
          `${p.createdAt}+09:00`,
        ],
      );
    }

    await client.query("COMMIT");

    console.log("Seed complete.");
    console.log(`  admin    : admin@example.com    / ${DEFAULT_PASSWORD}`);
    console.log(`  manager  : manager@example.com  / ${DEFAULT_PASSWORD}  (清掃部門)`);
    console.log(`  employee : employee@example.com / ${DEFAULT_PASSWORD}  (佐藤 花子)`);
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
