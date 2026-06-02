import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";
import {
  resolveSubmitStaffId,
  insertReportSession,
  replaceReportSession,
  validateAndExpandSession,
} from "@/lib/reports/session";

export const runtime = "nodejs";

const entrySchema = z.object({
  business_type_id: z.string().uuid(),
  count: z.coerce.number().min(0).max(100_000),
  vehicle_id: z.string().uuid().optional().nullable(),
  line_memo: z.record(z.string()).optional().nullable(),
});

const blockSchema = z.object({
  client_id: z.string().uuid(),
  site_id: z.string().uuid().optional().nullable(),
  entries: z.array(entrySchema).min(1),
});

const createSchema = z.object({
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  business_line_id: z.string().uuid(),
  memo: z.string().max(4000).optional().nullable(),
  customer_blocks: z.array(blockSchema).min(1),
  staff_id: z.string().uuid().optional(),
});

const listQuery = z.object({
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  business_line_id: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const q = listQuery.parse({
      work_date: url.searchParams.get("work_date") ?? undefined,
      business_line_id: url.searchParams.get("business_line_id") ?? undefined,
    });

    const pool = getPool();
    const params: unknown[] = [];
    const conds: string[] = [];

    if (user.role === "employee") {
      if (!user.staffId) return NextResponse.json({ items: [] });
      params.push(user.staffId);
      conds.push(`rs.staff_id = $${params.length}`);
    } else if (user.role === "manager") {
      params.push(user.departmentId);
      conds.push(`rs.staff_id IN (
        SELECT id FROM staffs WHERE department_id = $${params.length} AND deleted_at IS NULL
      )`);
    }

    if (q.work_date) {
      params.push(q.work_date);
      conds.push(`rs.work_date = $${params.length}::date`);
    }
    if (q.business_line_id) {
      params.push(q.business_line_id);
      conds.push(`rs.business_line_id = $${params.length}`);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT rs.id, rs.staff_id, st.name AS staff_name,
              rs.work_date::text, rs.business_line_id, bl.name AS business_line_name,
              rs.memo, rs.submitted_at,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'id', r.id,
                  'client_id', r.client_id,
                  'client_name', cc.name,
                  'site_id', r.site_id,
                  'site_name', si.name,
                  'business_type_id', r.business_type_id,
                  'business_type_name', bt.name,
                  'count', r.count
                ) ORDER BY cc.name, si.name, bt.name)
                 FROM business_reports r
                 JOIN client_companies cc ON cc.id = r.client_id
                 JOIN sites si ON si.id = r.site_id
                 JOIN business_types bt ON bt.id = r.business_type_id
                WHERE r.session_id = rs.id),
                '[]'::json
              ) AS entries
         FROM report_sessions rs
         JOIN business_lines bl ON bl.id = rs.business_line_id
         JOIN staffs st ON st.id = rs.staff_id
        ${where}
        ORDER BY rs.work_date DESC, rs.submitted_at DESC
        LIMIT 100`,
      params,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  const pool = getPool();
  const pgClient = await pool.connect();
  try {
    const user = await requireUser(request);
    const body = createSchema.parse(await parseJsonBody(request));
    const staffId = resolveSubmitStaffId(user, body.staff_id);

    await pgClient.query("BEGIN");
    const entries = await validateAndExpandSession(pgClient, user, staffId, body);
    const sessionId = await insertReportSession(pgClient, staffId, body, entries);
    await pgClient.query("COMMIT");

    const { rows } = await pool.query(
      `SELECT rs.id, rs.work_date::text, rs.memo, rs.submitted_at,
              (SELECT COUNT(*)::int FROM business_reports WHERE session_id = rs.id) AS entry_count
         FROM report_sessions rs WHERE rs.id = $1`,
      [sessionId],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    await pgClient.query("ROLLBACK");
    return handleRouteError(err);
  } finally {
    pgClient.release();
  }
}
