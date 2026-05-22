import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

type StaffListRow = {
  id: string;
  name: string;
  hourly_rate: number;
  department_id: string;
  department_name: string;
  site_ids: string[];
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { rows } = await getPool().query<StaffListRow>(
      `SELECT s.id, s.name, s.hourly_rate,
              s.department_id, d.name AS department_name,
              COALESCE(
                ARRAY_AGG(ssa.site_id) FILTER (WHERE ssa.site_id IS NOT NULL),
                ARRAY[]::uuid[]
              ) AS site_ids
         FROM staffs s
         JOIN departments d ON d.id = s.department_id
    LEFT JOIN staff_site_assigns ssa ON ssa.staff_id = s.id
        WHERE s.deleted_at IS NULL
     GROUP BY s.id, d.name
     ORDER BY s.name`,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "氏名を入力してください").max(100),
  department_id: z.string().uuid("部門を選択してください"),
  hourly_rate: z.number().int().min(0).max(1_000_000),
  site_ids: z.array(z.string().uuid()).default([]),
});

export async function POST(request: NextRequest) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request);
    const v = createSchema.parse(body);

    await client.query("BEGIN");
    const { rows } = await client.query<{
      id: string;
      name: string;
      hourly_rate: number;
      department_id: string;
    }>(
      `INSERT INTO staffs (name, department_id, hourly_rate)
       VALUES ($1, $2, $3)
       RETURNING id, name, department_id, hourly_rate`,
      [v.name, v.department_id, v.hourly_rate],
    );
    const staff = rows[0]!;
    if (v.site_ids.length > 0) {
      // Insert assignments in one statement using UNNEST.
      await client.query(
        `INSERT INTO staff_site_assigns (staff_id, site_id)
         SELECT $1, site_id FROM UNNEST($2::uuid[]) AS site_id`,
        [staff.id, v.site_ids],
      );
    }
    const { rows: full } = await client.query<{
      department_name: string;
    }>(`SELECT name AS department_name FROM departments WHERE id = $1`, [
      staff.department_id,
    ]);
    await client.query("COMMIT");
    return NextResponse.json(
      {
        item: {
          ...staff,
          department_name: full[0]!.department_name,
          site_ids: v.site_ids,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return handleRouteError(err);
  } finally {
    client.release();
  }
}
