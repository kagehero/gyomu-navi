import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

type ClientRow = {
  id: string;
  name: string;
  code: string;
  created_at: Date;
  updated_at: Date;
};

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    code: z.string().trim().min(1).max(20).optional(),
  })
  .refine((v) => v.name !== undefined || v.code !== undefined, {
    message: "更新する項目を指定してください",
  });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await parseJsonBody(request);
    const v = updateSchema.parse(body);
    const { rows } = await getPool().query<ClientRow>(
      `UPDATE client_companies
          SET name = COALESCE($1, name),
              code = COALESCE($2, code)
        WHERE id = $3 AND deleted_at IS NULL
        RETURNING id, name, code, created_at, updated_at`,
      [v.name ?? null, v.code ?? null, id],
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
      `UPDATE client_companies
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
