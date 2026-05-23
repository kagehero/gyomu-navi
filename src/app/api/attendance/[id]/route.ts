import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

const updateSchema = z
  .object({
    site_id: z.string().uuid().optional(),
    punch_in_at: z.string().datetime({ offset: true }).optional(),
    punch_out_at: z.string().datetime({ offset: true }).nullable().optional(),
    status: z.enum(["working", "done", "absent"]).optional(),
    punch_in_lat: z.number().min(-90).max(90).nullable().optional(),
    punch_in_lng: z.number().min(-180).max(180).nullable().optional(),
    punch_out_lat: z.number().min(-90).max(90).nullable().optional(),
    punch_out_lng: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "更新する項目を指定してください",
  });

type Ctx = { params: Promise<{ id: string }> };

/**
 * Build a dynamic UPDATE that only touches columns the caller actually sent.
 * `field !== undefined` is the gate: omitted = leave alone, present (including
 * null) = write.
 */
function buildPatchSql(
  v: z.infer<typeof updateSchema>,
  id: string,
): { sql: string; params: unknown[] } {
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (v.site_id !== undefined) add("site_id", v.site_id);
  if (v.punch_in_at !== undefined) add("punch_in_at", v.punch_in_at);
  if (v.punch_out_at !== undefined) add("punch_out_at", v.punch_out_at);
  if (v.status !== undefined) add("status", v.status);
  if (v.punch_in_lat !== undefined) add("punch_in_lat", v.punch_in_lat);
  if (v.punch_in_lng !== undefined) add("punch_in_lng", v.punch_in_lng);
  if (v.punch_out_lat !== undefined) add("punch_out_lat", v.punch_out_lat);
  if (v.punch_out_lng !== undefined) add("punch_out_lng", v.punch_out_lng);
  params.push(id);
  const sql = `
    WITH updated AS (
      UPDATE attendance_logs
         SET ${sets.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, staff_id, site_id, work_date, punch_in_at, punch_out_at,
                 status, punch_in_lat, punch_in_lng, punch_out_lat, punch_out_lng
    )
    SELECT u.id, u.staff_id, s.name AS staff_name,
           u.site_id, st.name AS site_name,
           u.work_date, u.punch_in_at, u.punch_out_at, u.status,
           u.punch_in_lat::float8  AS punch_in_lat,
           u.punch_in_lng::float8  AS punch_in_lng,
           u.punch_out_lat::float8 AS punch_out_lat,
           u.punch_out_lng::float8 AS punch_out_lng
      FROM updated u
      JOIN staffs s  ON s.id  = u.staff_id
      JOIN sites  st ON st.id = u.site_id`;
  return { sql, params };
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await parseJsonBody(request);
    const v = updateSchema.parse(body);
    const { sql, params } = buildPatchSql(v, id);
    const { rows } = await getPool().query(sql, params);
    if (!rows[0]) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const { rowCount } = await getPool().query(
      `DELETE FROM attendance_logs WHERE id = $1`,
      [id],
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
