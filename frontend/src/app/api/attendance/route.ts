import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireUser, AuthError } from "@/lib/auth/guards";
import { staffScopeWhere } from "@/lib/auth/scope";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

type AttendanceRow = {
  id: string;
  staff_id: string;
  staff_name: string;
  site_id: string;
  site_name: string;
  work_date: string;
  punch_in_at: Date;
  punch_out_at: Date | null;
  status: "working" | "done" | "absent";
  punch_in_lat: number | null;
  punch_in_lng: number | null;
  punch_out_lat: number | null;
  punch_out_lng: number | null;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で指定してください");

const listQuery = z.object({
  date: isoDate.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  staff_id: z.string().uuid().optional(),
  site_id: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const q = listQuery.parse({
      date: url.searchParams.get("date") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      staff_id: url.searchParams.get("staff_id") ?? undefined,
      site_id: url.searchParams.get("site_id") ?? undefined,
    });

    const params: unknown[] = [];
    const conditions: string[] = [];
    if (q.date) {
      params.push(q.date);
      conditions.push(`al.work_date = $${params.length}`);
    } else {
      if (q.from) {
        params.push(q.from);
        conditions.push(`al.work_date >= $${params.length}`);
      }
      if (q.to) {
        params.push(q.to);
        conditions.push(`al.work_date <= $${params.length}`);
      }
    }
    if (q.staff_id) {
      params.push(q.staff_id);
      conditions.push(`al.staff_id = $${params.length}`);
    }
    if (q.site_id) {
      params.push(q.site_id);
      conditions.push(`al.site_id = $${params.length}`);
    }

    const scope = staffScopeWhere(user, "al.staff_id", params.length);
    params.push(...scope.params);

    const where = [conditions.join(" AND "), scope.sql.replace(/^ AND /, "")]
      .filter(Boolean)
      .join(" AND ");

    const { rows } = await getPool().query<AttendanceRow>(
      `SELECT al.id, al.staff_id, s.name AS staff_name,
              al.site_id, st.name AS site_name,
              al.work_date, al.punch_in_at, al.punch_out_at, al.status,
              al.punch_in_lat::float8  AS punch_in_lat,
              al.punch_in_lng::float8  AS punch_in_lng,
              al.punch_out_lat::float8 AS punch_out_lat,
              al.punch_out_lng::float8 AS punch_out_lng
         FROM attendance_logs al
         JOIN staffs s  ON s.id  = al.staff_id
         JOIN sites  st ON st.id = al.site_id
        ${where ? "WHERE " + where : ""}
        ORDER BY al.work_date DESC, al.punch_in_at DESC
        LIMIT 500`,
      params,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  staff_id: z.string().uuid(),
  site_id: z.string().uuid(),
  work_date: isoDate,
  punch_in_at: z.string().datetime({ offset: true }),
  punch_out_at: z.string().datetime({ offset: true }).nullable().optional(),
  status: z.enum(["working", "done", "absent"]),
  punch_in_lat: z.number().min(-90).max(90).nullable().optional(),
  punch_in_lng: z.number().min(-180).max(180).nullable().optional(),
  punch_out_lat: z.number().min(-90).max(90).nullable().optional(),
  punch_out_lng: z.number().min(-180).max(180).nullable().optional(),
});

/** Admin-only manual insert. Used for correcting missed punches. */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request);
    const v = createSchema.parse(body);

    const { rows } = await getPool().query<AttendanceRow>(
      `WITH inserted AS (
         INSERT INTO attendance_logs
           (staff_id, site_id, work_date, punch_in_at, punch_out_at, status,
            punch_in_lat, punch_in_lng, punch_out_lat, punch_out_lng)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, staff_id, site_id, work_date, punch_in_at, punch_out_at,
                   status, punch_in_lat, punch_in_lng, punch_out_lat, punch_out_lng
       )
       SELECT i.id, i.staff_id, s.name AS staff_name,
              i.site_id, st.name AS site_name,
              i.work_date, i.punch_in_at, i.punch_out_at, i.status,
              i.punch_in_lat::float8  AS punch_in_lat,
              i.punch_in_lng::float8  AS punch_in_lng,
              i.punch_out_lat::float8 AS punch_out_lat,
              i.punch_out_lng::float8 AS punch_out_lng
         FROM inserted i
         JOIN staffs s  ON s.id  = i.staff_id
         JOIN sites  st ON st.id = i.site_id`,
      [
        v.staff_id, v.site_id, v.work_date,
        v.punch_in_at, v.punch_out_at ?? null, v.status,
        v.punch_in_lat ?? null, v.punch_in_lng ?? null,
        v.punch_out_lat ?? null, v.punch_out_lng ?? null,
      ],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return handleRouteError(err);
    return handleRouteError(err);
  }
}
