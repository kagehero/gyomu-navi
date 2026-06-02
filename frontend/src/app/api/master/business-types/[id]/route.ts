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

const updateSchema = z
  .object({
    client_id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100).optional(),
    site_id: z.string().uuid().nullable().optional(),
    business_line_id: z.string().uuid().nullable().optional(),
    unit_price_excl: z.number().min(0).nullable().optional(),
    unit_price_incl: z.number().min(0).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "更新する項目を指定してください",
  });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await parseJsonBody(request);
    const v = updateSchema.parse(body);

    const { rowCount } = await getPool().query(
      `UPDATE business_types
          SET client_id = COALESCE($1, client_id),
              name = COALESCE($2, name),
              site_id = CASE WHEN $3::boolean THEN $4 ELSE site_id END,
              business_line_id = CASE WHEN $5::boolean THEN $6 ELSE business_line_id END,
              unit_price_excl = CASE WHEN $7::boolean THEN $8 ELSE unit_price_excl END,
              unit_price_incl = CASE WHEN $9::boolean THEN $10 ELSE unit_price_incl END
        WHERE id = $11 AND deleted_at IS NULL`,
      [
        v.client_id ?? null,
        v.name ?? null,
        v.site_id !== undefined,
        v.site_id ?? null,
        v.business_line_id !== undefined,
        v.business_line_id ?? null,
        v.unit_price_excl !== undefined,
        v.unit_price_excl ?? null,
        v.unit_price_incl !== undefined,
        v.unit_price_incl ?? null,
        id,
      ],
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    const { rows } = await getPool().query(`${SELECT_BT} WHERE bt.id = $1`, [id]);
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const { rowCount } = await getPool().query(
      `UPDATE business_types SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
