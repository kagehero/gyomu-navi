import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

const SELECT_BOARD = `
  SELECT bp.id, bp.site_id, st.name AS site_name,
         bp.author_user_id, au.display_name AS author_display_name,
         bp.title, bp.body, bp.pinned,
         bp.created_at, bp.updated_at
    FROM board_posts bp
    JOIN sites st ON st.id = bp.site_id
    JOIN users au ON au.id = bp.author_user_id
`;

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    body: z.string().trim().min(1).max(10_000).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "更新する項目を指定してください",
  });

async function loadPostMeta(id: string) {
  const { rows } = await getPool().query<{ id: string; author_user_id: string }>(
    `SELECT id, author_user_id FROM board_posts WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const meta = await loadPostMeta(id);
    if (!meta) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    if (user.role !== "admin" && meta.author_user_id !== user.id) {
      return NextResponse.json({ error: "編集権限がありません" }, { status: 403 });
    }
    const body = await parseJsonBody(request);
    const v = updateSchema.parse(body);

    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (v.title !== undefined) add("title", v.title);
    if (v.body !== undefined) add("body", v.body);
    if (v.pinned !== undefined) add("pinned", v.pinned);
    params.push(id);
    await getPool().query(
      `UPDATE board_posts SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params,
    );

    const { rows } = await getPool().query(`${SELECT_BOARD} WHERE bp.id = $1`, [id]);
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const meta = await loadPostMeta(id);
    if (!meta) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    if (user.role !== "admin" && meta.author_user_id !== user.id) {
      return NextResponse.json({ error: "削除権限がありません" }, { status: 403 });
    }
    await getPool().query(`DELETE FROM board_posts WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
