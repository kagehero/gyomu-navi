import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";

export const runtime = "nodejs";

/**
 * Sites visible to the current user, scoped by role:
 *   employee : their staff_site_assigns
 *   manager  : all sites their department's staff are assigned to
 *   admin    : all live sites
 *
 * Used by punch-in, report submission and any other employee-side screen that
 * needs a "your sites" picker, without exposing the admin-only /api/master/sites.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const pool = getPool();

    if (user.role === "admin") {
      const { rows } = await pool.query(
        `SELECT s.id, s.client_id, c.name AS client_name, s.name,
                s.latitude::float8  AS latitude,
                s.longitude::float8 AS longitude,
                s.radius_m
           FROM sites s
           JOIN client_companies c ON c.id = s.client_id
          WHERE s.deleted_at IS NULL
          ORDER BY c.code, s.name`,
      );
      return NextResponse.json({ items: rows });
    }

    if (user.role === "employee") {
      const { rows } = await pool.query(
        `SELECT s.id, s.client_id, c.name AS client_name, s.name,
                s.latitude::float8  AS latitude,
                s.longitude::float8 AS longitude,
                s.radius_m
           FROM sites s
           JOIN client_companies c ON c.id = s.client_id
           JOIN staff_site_assigns ssa ON ssa.site_id = s.id
          WHERE s.deleted_at IS NULL
            AND ssa.staff_id = $1
          ORDER BY c.code, s.name`,
        [user.staffId],
      );
      return NextResponse.json({ items: rows });
    }

    // manager
    const { rows } = await pool.query(
      `SELECT s.id, s.client_id, c.name AS client_name, c.code AS client_code, s.name,
              s.latitude::float8  AS latitude,
              s.longitude::float8 AS longitude,
              s.radius_m
         FROM sites s
         JOIN client_companies c ON c.id = s.client_id
        WHERE s.deleted_at IS NULL
          AND s.id IN (
            SELECT ssa.site_id
              FROM staff_site_assigns ssa
              JOIN staffs stf ON stf.id = ssa.staff_id
             WHERE stf.deleted_at IS NULL
               AND stf.department_id = $1
          )
        ORDER BY c.code, s.name`,
      [user.departmentId],
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
