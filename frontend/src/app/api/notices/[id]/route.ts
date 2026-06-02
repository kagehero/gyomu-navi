import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";
import { SELECT_NOTICE_PREFIX, visibilityClause, type NoticeRow } from "@/lib/notices";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function loadNoticeMeta(id: string) {
  const { rows } = await getPool().query<{
    id: string;
    from_user_id: string;
  }>(`SELECT id, from_user_id FROM notices WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;

    // Visibility: only return the row if the user is allowed to see it.
    const vis = visibilityClause(user, 2);
    const params: unknown[] = [user.id, id, ...vis.params];

    const { rows } = await getPool().query<NoticeRow>(
      `${SELECT_NOTICE_PREFIX} WHERE n.id = $2 AND ${vis.sql}`,
      params,
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    // Mark read on view. Idempotent — primary key (notice_id, user_id) blocks
    // dupes; ON CONFLICT keeps the original read_at.
    await getPool().query(
      `INSERT INTO notice_reads (notice_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (notice_id, user_id) DO NOTHING`,
      [id, user.id],
    );

    return NextResponse.json({ item: { ...row, is_read: true } });
  } catch (err) {
    return handleRouteError(err);
  }
}

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    body: z.string().trim().min(1).max(10_000).optional(),
  })
  .refine((v) => v.title !== undefined || v.body !== undefined, {
    message: "更新する項目を指定してください",
  });

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const meta = await loadNoticeMeta(id);
    if (!meta) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    if (user.role !== "admin" && meta.from_user_id !== user.id) {
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
    params.push(id);
    await getPool().query(
      `UPDATE notices SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params,
    );

    const { rows } = await getPool().query<NoticeRow>(
      `${SELECT_NOTICE_PREFIX} WHERE n.id = $2`,
      [user.id, id],
    );
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const meta = await loadNoticeMeta(id);
    if (!meta) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }
    if (user.role !== "admin" && meta.from_user_id !== user.id) {
      return NextResponse.json({ error: "削除権限がありません" }, { status: 403 });
    }
    await getPool().query(`DELETE FROM notices WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
