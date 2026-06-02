import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";
import { visibleClientIdsForLine } from "@/lib/reports/scoping";

export const runtime = "nodejs";

const querySchema = z.object({
  client_id: z.string().uuid(),
  business_line_id: z.string().uuid().optional(),
});

/** Vehicle / station options for report entry (from imported Excel vehicle lists). */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const q = querySchema.parse({
      client_id: url.searchParams.get("client_id"),
      business_line_id: url.searchParams.get("business_line_id") ?? undefined,
    });

    const pool = getPool();
    if (q.business_line_id) {
      const allowedClients = await visibleClientIdsForLine(pool, user, q.business_line_id);
      if (allowedClients !== null && !allowedClients.includes(q.client_id)) {
        return NextResponse.json({ items: [] });
      }
    }

    const { rows } = await pool.query(
      `SELECT v.id, v.station_name, v.vehicle_label, v.surcharge_label,
              vl.id AS vehicle_list_id, vl.name AS vehicle_list_name
         FROM vehicles v
         JOIN vehicle_lists vl ON vl.id = v.vehicle_list_id
        WHERE vl.client_id = $1
        ORDER BY vl.name, v.sort_order, v.vehicle_label`,
      [q.client_id],
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
