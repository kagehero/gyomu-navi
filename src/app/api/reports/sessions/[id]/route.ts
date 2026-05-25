import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth/guards";
import { canAccessStaff } from "@/lib/auth/scope";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";
import {
  replaceReportSession,
  resolveSubmitStaffId,
  validateAndExpandSession,
  type CreateSessionInput,
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

const updateSchema = z.object({
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  business_line_id: z.string().uuid(),
  memo: z.string().max(4000).optional().nullable(),
  customer_blocks: z.array(blockSchema).min(1),
});

type Ctx = { params: Promise<{ id: string }> };

async function loadSession(id: string) {
  const { rows } = await getPool().query<{
    id: string;
    staff_id: string;
    work_date: string;
    business_line_id: string;
    business_line_name: string;
    memo: string | null;
    submitted_at: Date;
  }>(
    `SELECT rs.id, rs.staff_id, rs.work_date::text, rs.business_line_id,
            bl.name AS business_line_name, rs.memo, rs.submitted_at
       FROM report_sessions rs
       JOIN business_lines bl ON bl.id = rs.business_line_id
      WHERE rs.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const session = await loadSession(id);
    if (!session) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    if (!(await canAccessStaff(user, session.staff_id))) {
      return NextResponse.json({ error: "閲覧権限がありません" }, { status: 403 });
    }

    const { rows: entries } = await getPool().query(
      `SELECT r.id, r.client_id, cc.name AS client_name,
              r.site_id, si.name AS site_name,
              r.business_type_id, bt.name AS business_type_name, r.count,
              r.vehicle_id, v.vehicle_label AS vehicle_label,
              r.line_memo, r.auto_generated
         FROM business_reports r
         JOIN client_companies cc ON cc.id = r.client_id
         JOIN sites si ON si.id = r.site_id
         JOIN business_types bt ON bt.id = r.business_type_id
         LEFT JOIN vehicles v ON v.id = r.vehicle_id
        WHERE r.session_id = $1
          AND (r.auto_generated = false OR $2 = 'admin')
        ORDER BY cc.name, si.name, bt.name`,
      [id, user.role],
    );

    return NextResponse.json({ item: { ...session, entries } });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const pool = getPool();
  const pgClient = await pool.connect();
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const session = await loadSession(id);
    if (!session) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    if (user.role === "employee") {
      if (user.staffId !== session.staff_id) {
        throw new AuthError(403, "編集権限がありません");
      }
    } else if (user.role === "manager") {
      if (!(await canAccessStaff(user, session.staff_id))) {
        throw new AuthError(403, "編集権限がありません");
      }
    }

    const body = updateSchema.parse(await parseJsonBody(request));
    const input: CreateSessionInput = {
      ...body,
      staff_id: session.staff_id,
      session_id: id,
    };

    await pgClient.query("BEGIN");
    const entries = await validateAndExpandSession(pgClient, user, session.staff_id, input);
    await replaceReportSession(pgClient, id, session.staff_id, input, entries);
    await pgClient.query("COMMIT");

    const updated = await loadSession(id);
    return NextResponse.json({ item: updated });
  } catch (err) {
    await pgClient.query("ROLLBACK");
    return handleRouteError(err);
  } finally {
    pgClient.release();
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const session = await loadSession(id);
    if (!session) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    if (user.role === "employee") {
      if (user.staffId !== session.staff_id) {
        throw new AuthError(403, "削除権限がありません");
      }
    } else if (user.role === "manager") {
      throw new AuthError(403, "削除権限がありません");
    } else if (user.role !== "admin") {
      throw new AuthError(403, "削除権限がありません");
    }

    const pool = getPool();
    await pool.query(`DELETE FROM business_reports WHERE session_id = $1`, [id]);
    await pool.query(`DELETE FROM report_sessions WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
