import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

/**
 * Business types visible to the current user, scoped by which clients their
 * sites belong to. Used by the report-submission form so the dropdown only
 * shows business types that are valid for the picked site.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const pool = getPool();

    if (user.role === "admin") {
      const { rows } = await pool.query(
        `SELECT bt.id, bt.client_id, c.name AS client_name, bt.name
           FROM business_types bt
           JOIN client_companies c ON c.id = bt.client_id
          WHERE bt.deleted_at IS NULL
          ORDER BY c.code, bt.name`,
      );
      return NextResponse.json({ items: rows });
    }

    if (user.role === "employee") {
      const { rows } = await pool.query(
        `SELECT bt.id, bt.client_id, c.name AS client_name, bt.name
           FROM business_types bt
           JOIN client_companies c ON c.id = bt.client_id
          WHERE bt.deleted_at IS NULL
            AND bt.client_id IN (
              SELECT DISTINCT s.client_id
                FROM staff_site_assigns ssa
                JOIN sites s ON s.id = ssa.site_id
               WHERE ssa.staff_id = $1
                 AND s.deleted_at IS NULL
            )
          ORDER BY c.code, bt.name`,
        [user.staffId],
      );
      return NextResponse.json({ items: rows });
    }

    // manager
    const { rows } = await pool.query(
      `SELECT bt.id, bt.client_id, c.name AS client_name, bt.name
         FROM business_types bt
         JOIN client_companies c ON c.id = bt.client_id
        WHERE bt.deleted_at IS NULL
          AND bt.client_id IN (
            SELECT DISTINCT s.client_id
              FROM staff_site_assigns ssa
              JOIN sites s   ON s.id   = ssa.site_id
              JOIN staffs st ON st.id  = ssa.staff_id
             WHERE st.department_id = $1
               AND st.deleted_at IS NULL
               AND s.deleted_at IS NULL
          )
        ORDER BY c.code, bt.name`,
      [user.departmentId],
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
