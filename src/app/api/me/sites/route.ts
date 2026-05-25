import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";
import { visibleSiteIdsForClient } from "@/lib/reports/scoping";

export const runtime = "nodejs";

const querySchema = z.object({
  client_id: z.string().uuid().optional(),
});

/**
 * Sites visible to the current user. Optional client_id filter for reporting flow.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const q = querySchema.parse({ client_id: url.searchParams.get("client_id") ?? undefined });
    const pool = getPool();

    if (q.client_id) {
      const allowed = await visibleSiteIdsForClient(pool, user, q.client_id);
      if (allowed !== null && allowed.length === 0) {
        return NextResponse.json({ items: [] });
      }
      const params: unknown[] = [q.client_id];
      let filter = "";
      if (allowed !== null) {
        params.push(allowed);
        filter = ` AND s.id = ANY($${params.length}::uuid[])`;
      }
      const { rows } = await pool.query(
        `SELECT s.id, s.client_id, c.name AS client_name, s.name,
                s.is_billing_branch
           FROM sites s
           JOIN client_companies c ON c.id = s.client_id
          WHERE s.client_id = $1 AND s.deleted_at IS NULL ${filter}
          ORDER BY s.name`,
        params,
      );
      return NextResponse.json({ items: rows });
    }

    if (user.role === "admin") {
      const { rows } = await pool.query(
        `SELECT s.id, s.client_id, c.name AS client_name, s.name,
                s.latitude::float8 AS latitude, s.longitude::float8 AS longitude,
                s.radius_m, s.is_billing_branch
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
                s.latitude::float8 AS latitude, s.longitude::float8 AS longitude,
                s.radius_m, s.is_billing_branch
           FROM sites s
           JOIN client_companies c ON c.id = s.client_id
           JOIN staff_client_assigns sca ON sca.client_id = s.client_id
          WHERE s.deleted_at IS NULL AND sca.staff_id = $1
          ORDER BY c.code, s.name`,
        [user.staffId],
      );
      return NextResponse.json({ items: rows });
    }

    const { rows } = await pool.query(
      `SELECT s.id, s.client_id, c.name AS client_name, s.name,
              s.latitude::float8 AS latitude, s.longitude::float8 AS longitude,
              s.radius_m, s.is_billing_branch
         FROM sites s
         JOIN client_companies c ON c.id = s.client_id
        WHERE s.deleted_at IS NULL
          AND s.client_id IN (
            SELECT sca.client_id
              FROM staff_client_assigns sca
              JOIN staffs st ON st.id = sca.staff_id
             WHERE st.department_id = $1 AND st.deleted_at IS NULL
          )
        ORDER BY c.code, s.name`,
      [user.departmentId],
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
