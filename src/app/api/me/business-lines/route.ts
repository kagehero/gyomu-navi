import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";
import { visibleBusinessLineIds } from "@/lib/reports/scoping";

export const runtime = "nodejs";

/** Business lines (部門) visible to the current staff for reporting. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const pool = getPool();
    const allowed = await visibleBusinessLineIds(pool, user);

    const params: unknown[] = [];
    let where = `bl.deleted_at IS NULL`;
    if (allowed !== null) {
      if (allowed.length === 0) return NextResponse.json({ items: [] });
      params.push(allowed);
      where += ` AND bl.id = ANY($${params.length}::uuid[])`;
    }

    const clientCountSql =
      user.role === "employee" && user.staffId
        ? `, (
             SELECT COUNT(DISTINCT sca.client_id)::int
               FROM staff_client_assigns sca
               JOIN client_business_lines cbl
                 ON cbl.client_id = sca.client_id AND cbl.business_line_id = bl.id
              WHERE sca.staff_id = $${params.length + 1}
           ) AS client_count`
        : "";

    if (user.role === "employee" && user.staffId) {
      params.push(user.staffId);
    }

    const { rows } = await pool.query(
      `SELECT bl.id, bl.name, bl.sort_order${clientCountSql}
         FROM business_lines bl
        WHERE ${where}
        ORDER BY bl.sort_order, bl.name`,
      params,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
