import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

type BusinessTypeRow = {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

const updateSchema = z
  .object({
    client_id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100).optional(),
  })
  .refine((v) => v.client_id !== undefined || v.name !== undefined, {
    message: "更新する項目を指定してください",
  });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await parseJsonBody(request);
    const v = updateSchema.parse(body);
    const { rows } = await getPool().query<BusinessTypeRow>(
      `WITH updated AS (
         UPDATE business_types
            SET client_id = COALESCE($1, client_id),
                name      = COALESCE($2, name)
          WHERE id = $3 AND deleted_at IS NULL
          RETURNING id, client_id, name, created_at, updated_at
       )
       SELECT u.*, c.name AS client_name
         FROM updated u
         JOIN client_companies c ON c.id = u.client_id`,
      [v.client_id ?? null, v.name ?? null, id],
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
      `UPDATE business_types
          SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL`,
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
