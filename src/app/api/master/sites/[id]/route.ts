import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

const SELECT_SITE = `
  SELECT s.id, s.client_id, c.name AS client_name,
         s.name,
         s.latitude::float8  AS latitude,
         s.longitude::float8 AS longitude,
         s.radius_m,
         s.is_billing_branch,
         s.created_at, s.updated_at
    FROM sites s
    JOIN client_companies c ON c.id = s.client_id
`;

const updateSchema = z
  .object({
    client_id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(255).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    radius_m: z.number().int().positive().max(100_000).optional(),
    is_billing_branch: z.boolean().optional(),
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
    const { rows } = await getPool().query(
      `WITH updated AS (
         UPDATE sites
            SET client_id = COALESCE($1, client_id),
                name = COALESCE($2, name),
                latitude = COALESCE($3, latitude),
                longitude = COALESCE($4, longitude),
                radius_m = COALESCE($5, radius_m),
                is_billing_branch = COALESCE($6, is_billing_branch)
          WHERE id = $7 AND deleted_at IS NULL
          RETURNING id
       )
       ${SELECT_SITE}
       JOIN updated u ON u.id = s.id`,
      [
        v.client_id ?? null,
        v.name ?? null,
        v.latitude ?? null,
        v.longitude ?? null,
        v.radius_m ?? null,
        v.is_billing_branch ?? null,
        id,
      ],
    );
    if (!rows[0]) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
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
      `UPDATE sites SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
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
