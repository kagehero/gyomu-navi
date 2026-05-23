import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";
import { jstWorkDate } from "@/lib/dates";

export const runtime = "nodejs";

const bodySchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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

    const workDate = jstWorkDate();
    const now = new Date().toISOString();

    const { rows } = await getPool().query(
      `UPDATE attendance_logs
          SET punch_out_at  = $1,
              status        = 'done',
              punch_out_lat = $2,
              punch_out_lng = $3
        WHERE staff_id = $4
          AND work_date = $5
          AND punch_out_at IS NULL
        RETURNING id, staff_id, site_id, work_date, punch_in_at, punch_out_at,
                  status,
                  punch_in_lat::float8  AS punch_in_lat,
                  punch_in_lng::float8  AS punch_in_lng,
                  punch_out_lat::float8 AS punch_out_lat,
                  punch_out_lng::float8 AS punch_out_lng`,
      [now, v.latitude ?? null, v.longitude ?? null, user.staffId, workDate],
    );
    if (!rows[0]) {
      return NextResponse.json(
        { error: "本日の未退勤の出勤打刻が見つかりません" },
        { status: 404 },
      );
    }
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    return handleRouteError(err);
  }
}
