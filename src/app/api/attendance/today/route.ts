import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";
import { jstWorkDate } from "@/lib/dates";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (user.role !== "employee" || !user.staffId) {
      return NextResponse.json(
        { error: "従業員アカウントでのみ参照できます" },
        { status: 403 },
      );
    }
    const workDate = jstWorkDate();
    const { rows } = await getPool().query(
      `SELECT al.id, al.staff_id, al.site_id, st.name AS site_name,
              al.work_date, al.punch_in_at, al.punch_out_at, al.status,
              al.punch_in_lat::float8  AS punch_in_lat,
              al.punch_in_lng::float8  AS punch_in_lng,
              al.punch_out_lat::float8 AS punch_out_lat,
              al.punch_out_lng::float8 AS punch_out_lng
         FROM attendance_logs al
         JOIN sites st ON st.id = al.site_id
        WHERE al.staff_id = $1 AND al.work_date = $2`,
      [user.staffId, workDate],
    );
    return NextResponse.json({ item: rows[0] ?? null, work_date: workDate });
  } catch (err) {
    return handleRouteError(err);
  }
}
