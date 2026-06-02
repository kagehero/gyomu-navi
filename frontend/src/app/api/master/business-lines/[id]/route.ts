import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    sort_order: z.number().int().min(0).max(9999).optional(),
  })
  .refine((v) => v.name !== undefined || v.sort_order !== undefined, {
    message: "更新する項目を指定してください",
  });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await parseJsonBody(request);
    const v = updateSchema.parse(body);
    const { rows, rowCount } = await getPool().query(
      `UPDATE business_lines
          SET name = COALESCE($1, name),
              sort_order = COALESCE($2, sort_order)
        WHERE id = $3 AND deleted_at IS NULL
        RETURNING id, name, sort_order`,
      [v.name ?? null, v.sort_order ?? null, id],
    );
    if (rowCount === 0) {
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
      `UPDATE business_lines SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
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
