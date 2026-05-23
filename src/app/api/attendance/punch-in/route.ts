import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";
import { haversineMeters } from "@/lib/geo";
import { jstWorkDate } from "@/lib/dates";

export const runtime = "nodejs";

const bodySchema = z.object({
  site_id: z.string().uuid("現場を選択してください"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (user.role !== "employee" || !user.staffId) {
      return NextResponse.json(
        { error: "従業員アカウントでのみ打刻できます" },
        { status: 403 },
      );
    }
    const body = await parseJsonBody(request);
    const v = bodySchema.parse(body);

    const pool = getPool();

    // 1) Site must exist and be one of the user's assigned sites.
    const { rows: siteRows } = await pool.query<{
      latitude: number;
      longitude: number;
      radius_m: number;
      assigned: boolean;
    }>(
      `SELECT s.latitude::float8  AS latitude,
              s.longitude::float8 AS longitude,
              s.radius_m,
              EXISTS (
                SELECT 1 FROM staff_site_assigns ssa
                 WHERE ssa.site_id = s.id AND ssa.staff_id = $2
              ) AS assigned
         FROM sites s
        WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [v.site_id, user.staffId],
    );
    const site = siteRows[0];
    if (!site) {
      return NextResponse.json({ error: "現場が見つかりません" }, { status: 404 });
    }
    if (!site.assigned) {
      return NextResponse.json(
        { error: "この現場には配属されていません" },
        { status: 403 },
      );
    }

    // 2) GPS check.
    const distanceM = haversineMeters(
      site.latitude,
      site.longitude,
      v.latitude,
      v.longitude,
    );
    if (distanceM > site.radius_m) {
      return NextResponse.json(
        {
          error: `現場から ${Math.round(distanceM)}m 離れています（許容: ${site.radius_m}m）`,
          code: "out_of_range",
        },
        { status: 400 },
      );
    }

    // 3) Insert. UNIQUE(staff_id, work_date) prevents double punch-in.
    const workDate = jstWorkDate();
    const now = new Date().toISOString();
    try {
      const { rows } = await pool.query(
        `INSERT INTO attendance_logs
           (staff_id, site_id, work_date, punch_in_at, status,
            punch_in_lat, punch_in_lng)
         VALUES ($1, $2, $3, $4, 'working', $5, $6)
         RETURNING id, staff_id, site_id, work_date, punch_in_at,
                   punch_out_at, status,
                   punch_in_lat::float8  AS punch_in_lat,
                   punch_in_lng::float8  AS punch_in_lng,
                   punch_out_lat::float8 AS punch_out_lat,
                   punch_out_lng::float8 AS punch_out_lng`,
        [user.staffId, v.site_id, workDate, now, v.latitude, v.longitude],
      );
      return NextResponse.json({ item: rows[0] }, { status: 201 });
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "23505"
      ) {
        return NextResponse.json(
          { error: "本日は既に出勤打刻されています" },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
