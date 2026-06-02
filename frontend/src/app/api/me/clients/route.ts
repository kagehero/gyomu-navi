import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";
import { visibleClientIdsForLine } from "@/lib/reports/scoping";

export const runtime = "nodejs";

const querySchema = z.object({
  business_line_id: z.string().uuid("部門を選択してください"),
});

/** Customers (顧客) visible to the user within a business line. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const q = querySchema.parse({
      business_line_id: url.searchParams.get("business_line_id"),
    });

    const pool = getPool();
    const allowed = await visibleClientIdsForLine(pool, user, q.business_line_id);

    const params: unknown[] = [q.business_line_id];
    let clientFilter = "";
    if (allowed !== null) {
      if (allowed.length === 0) return NextResponse.json({ items: [] });
      params.push(allowed);
      clientFilter = ` AND c.id = ANY($${params.length}::uuid[])`;
    }

    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.code,
              (SELECT COUNT(*)::int FROM sites s
                WHERE s.client_id = c.id AND s.deleted_at IS NULL) AS site_count
         FROM client_companies c
         JOIN client_business_lines cbl ON cbl.client_id = c.id
        WHERE cbl.business_line_id = $1
          AND c.deleted_at IS NULL
          ${clientFilter}
        ORDER BY c.name`,
      params,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}
