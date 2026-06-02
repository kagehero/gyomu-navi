import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { staffScopeWhere } from "@/lib/auth/scope";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";
import { jstWorkDate } from "@/lib/dates";

export const runtime = "nodejs";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * KPI snapshot for a given work_date (defaults to today, JST).
 *  - total_staff : staff visible to the requester
 *  - present     : has any attendance row that day (working|done)
 *  - working     : status='working' right now
 *  - done        : status='done'
 *  - absent      : visible staff with no row that day
 *
 * Scoped per role: admin sees the whole org, manager their department,
 * employee just themselves (mostly useful as a personal "did I clock in?").
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const dateRaw = url.searchParams.get("date");
    const workDate = dateRaw ? isoDate.parse(dateRaw) : jstWorkDate();

    const pool = getPool();

    // 1) total visible staff
    const totalScope = staffScopeWhere(user, "s.id", 0);
    const totalSql = `
      SELECT count(*)::int AS total
        FROM staffs s
       WHERE s.deleted_at IS NULL
       ${totalScope.sql}
    `;
    const { rows: totalRows } = await pool.query<{ total: number }>(
      totalSql,
      totalScope.params,
    );
    const total = totalRows[0]?.total ?? 0;

    // 2) attendance counts for that day, scoped the same way
    const attScope = staffScopeWhere(user, "al.staff_id", 1);
    const params: unknown[] = [workDate, ...attScope.params];
    const { rows: attRows } = await pool.query<{
      status: "working" | "done" | "absent";
      c: number;
    }>(
      `SELECT al.status, count(*)::int AS c
         FROM attendance_logs al
        WHERE al.work_date = $1
        ${attScope.sql}
        GROUP BY al.status`,
      params,
    );
    const counts = { working: 0, done: 0, absent: 0 };
    for (const r of attRows) counts[r.status] = r.c;
    const present = counts.working + counts.done;
    const absent = Math.max(0, total - present);

    return NextResponse.json({
      work_date: workDate,
      total,
      present,
      working: counts.working,
      done: counts.done,
      late: 0, // Phase 1: no late detection
      absent,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
