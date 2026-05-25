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
  department_id: string | null;
  department_name: string | null;
  client_ids: string[];
  business_line_ids: string[];
  login_email: string | null;
  login_approved_at: string | null;
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { rows } = await getPool().query<StaffListRow>(
      `SELECT s.id, s.name, s.hourly_rate,
              s.department_id, d.name AS department_name,
              COALESCE(
                ARRAY_AGG(DISTINCT sca.client_id) FILTER (WHERE sca.client_id IS NOT NULL),
                ARRAY[]::uuid[]
              ) AS client_ids,
              COALESCE(
                ARRAY_AGG(DISTINCT sbla.business_line_id) FILTER (WHERE sbla.business_line_id IS NOT NULL),
                ARRAY[]::uuid[]
              ) AS business_line_ids,
              MAX(u.email) AS login_email,
              MAX(u.login_approved_at) AS login_approved_at
         FROM staffs s
    LEFT JOIN departments d ON d.id = s.department_id
    LEFT JOIN staff_client_assigns sca ON sca.staff_id = s.id
    LEFT JOIN staff_business_line_assigns sbla ON sbla.staff_id = s.id
    LEFT JOIN users u ON u.staff_id = s.id
                      AND u.app_role = 'employee'
                      AND u.deleted_at IS NULL
        WHERE s.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM users u2
             WHERE u2.staff_id = s.id
               AND u2.app_role = 'employee'
               AND u2.deleted_at IS NULL
          )
     GROUP BY s.id, d.name
     ORDER BY (MAX(u.login_approved_at) IS NULL) DESC, s.name`,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  department_id: z.string().uuid().optional(),
  hourly_rate: z.number().int().min(0).max(1_000_000).optional(),
  client_ids: z.array(z.string().uuid()).optional(),
  business_line_ids: z.array(z.string().uuid()).optional(),
});

/** Staff records are created via employee self-registration at /register. */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    createSchema.parse(await parseJsonBody(request));
    return NextResponse.json(
      {
        error:
          "従業員は「従業員アカウント登録」ページからログイン情報を登録してください。承認はスタッフ一覧から行います。",
      },
      { status: 400 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
