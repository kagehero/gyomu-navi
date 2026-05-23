import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError } from "@/lib/api/errors";
import { visibilityClause } from "@/lib/notices";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Idempotent: marking an already-read notice as read is a no-op. */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;

    // Only allow if the user can actually see the notice.
    const vis = visibilityClause(user, 1);
    const params: unknown[] = [id, ...vis.params];
    const { rows } = await getPool().query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM notices n WHERE n.id = $1 AND ${vis.sql}
       ) AS exists`,
      params,
    );
    if (!rows[0]?.exists) {
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    await getPool().query(
      `INSERT INTO notice_reads (notice_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (notice_id, user_id) DO NOTHING`,
      [id, user.id],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
