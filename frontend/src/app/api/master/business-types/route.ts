import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

const SELECT_BT = `
  SELECT bt.id, bt.client_id, c.name AS client_name,
         bt.site_id, si.name AS site_name,
         bt.business_line_id, bl.name AS business_line_name,
         bt.name,
         bt.unit_price_excl::float8 AS unit_price_excl,
         bt.unit_price_incl::float8 AS unit_price_incl,
         bt.created_at, bt.updated_at
    FROM business_types bt
    JOIN client_companies c ON c.id = bt.client_id
    LEFT JOIN sites si ON si.id = bt.site_id
    LEFT JOIN business_lines bl ON bl.id = bt.business_line_id
`;

const createSchema = z.object({
  client_id: z.string().uuid("顧客を選択してください"),
  name: z.string().trim().min(1, "業務名を入力してください").max(100),
  site_id: z.string().uuid().optional().nullable(),
  business_line_id: z.string().uuid().optional().nullable(),
  unit_price_excl: z.number().min(0).optional().nullable(),
  unit_price_incl: z.number().min(0).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const clientId = url.searchParams.get("client_id");
    const params: unknown[] = [];
    let where = `bt.deleted_at IS NULL`;
    if (clientId) {
      params.push(clientId);
      where += ` AND bt.client_id = $${params.length}`;
    }
    const { rows } = await getPool().query(
      `${SELECT_BT} WHERE ${where} ORDER BY c.name, si.name NULLS FIRST, bt.name`,
      params,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request);
    const v = createSchema.parse(body);
    const { rows } = await getPool().query(
      `WITH inserted AS (
         INSERT INTO business_types
           (client_id, site_id, business_line_id, name, unit_price_excl, unit_price_incl)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id
       )
       ${SELECT_BT}
       JOIN inserted i ON i.id = bt.id`,
      [
        v.client_id,
        v.site_id ?? null,
        v.business_line_id ?? null,
        v.name,
        v.unit_price_excl ?? null,
        v.unit_price_incl ?? null,
      ],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
