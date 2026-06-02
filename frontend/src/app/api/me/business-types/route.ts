import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";
import { visibleClientIdsForLine } from "@/lib/reports/scoping";

export const runtime = "nodejs";

const querySchema = z.object({
  business_line_id: z.string().uuid(),
  client_id: z.string().uuid(),
  site_id: z.string().uuid().optional(),
});

/**
 * Business types for report entry. Prices are omitted for non-admin users.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const q = querySchema.parse({
      business_line_id: url.searchParams.get("business_line_id"),
      client_id: url.searchParams.get("client_id"),
      site_id: url.searchParams.get("site_id") ?? undefined,
    });

    const pool = getPool();
    const allowedClients = await visibleClientIdsForLine(pool, user, q.business_line_id);
    if (allowedClients !== null && !allowedClients.includes(q.client_id)) {
      return NextResponse.json({ items: [] });
    }

    const params: unknown[] = [q.client_id, q.business_line_id];
    let siteFilter = "";
    if (q.site_id) {
      params.push(q.site_id);
      siteFilter = ` AND (bt.site_id IS NULL OR bt.site_id = $3)`;
    } else {
      siteFilter = ` AND bt.site_id IS NULL`;
    }

    const priceCols =
      user.role === "admin"
        ? `, bt.unit_price_excl::float8 AS unit_price_excl
           , bt.unit_price_incl::float8 AS unit_price_incl`
        : "";

    const staffFilter =
      user.role === "employee" ? ` AND bt.staff_enterable = true` : "";

    const { rows } = await pool.query(
      `SELECT bt.id, bt.client_id, c.name AS client_name, bt.site_id, bt.name,
              bt.input_unit, bt.vehicle_select_mode, bt.line_memo_fields
              ${priceCols}
         FROM business_types bt
         JOIN client_companies c ON c.id = bt.client_id
        WHERE bt.deleted_at IS NULL
          AND bt.client_id = $1
          AND (bt.business_line_id IS NULL OR bt.business_line_id = $2)
          ${siteFilter}
          ${staffFilter}
        ORDER BY bt.name`,
      params,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
