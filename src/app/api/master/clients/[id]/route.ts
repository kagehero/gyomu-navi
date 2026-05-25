import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";
import type { PoolClient } from "pg";

export const runtime = "nodejs";

async function syncClientBusinessLines(
  client: PoolClient,
  clientId: string,
  businessLineIds: string[],
) {
  await client.query(`DELETE FROM client_business_lines WHERE client_id = $1`, [clientId]);
  if (businessLineIds.length > 0) {
    await client.query(
      `INSERT INTO client_business_lines (client_id, business_line_id)
       SELECT $1, bl_id FROM UNNEST($2::uuid[]) AS bl_id`,
      [clientId, businessLineIds],
    );
  }
}

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    code: z.string().trim().min(1).max(20).optional(),
    business_line_ids: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined || v.code !== undefined || v.business_line_ids !== undefined,
    { message: "更新する項目を指定してください" },
  );

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const pool = getPool();
  const pgClient = await pool.connect();
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const body = await parseJsonBody(request);
    const v = updateSchema.parse(body);

    await pgClient.query("BEGIN");
    const { rows, rowCount } = await pgClient.query(
      `UPDATE client_companies
          SET name = COALESCE($1, name),
              code = COALESCE($2, code)
        WHERE id = $3 AND deleted_at IS NULL
        RETURNING id, name, code, created_at, updated_at`,
      [v.name ?? null, v.code ?? null, id],
    );
    if (rowCount === 0) {
      await pgClient.query("ROLLBACK");
      return NextResponse.json({ error: "対象が見つかりません" }, { status: 404 });
    }

    let businessLineIds: string[] = [];
    if (v.business_line_ids !== undefined) {
      await syncClientBusinessLines(pgClient, id, v.business_line_ids);
      businessLineIds = v.business_line_ids;
    } else {
      const { rows: blRows } = await pgClient.query<{ business_line_id: string }>(
        `SELECT business_line_id FROM client_business_lines WHERE client_id = $1`,
        [id],
      );
      businessLineIds = blRows.map((r) => r.business_line_id);
    }

    await pgClient.query("COMMIT");
    return NextResponse.json({ item: { ...rows[0], business_line_ids: businessLineIds } });
  } catch (err) {
    await pgClient.query("ROLLBACK").catch(() => {});
    return handleRouteError(err);
  } finally {
    pgClient.release();
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(request);
    const { id } = await ctx.params;
    const { rowCount } = await getPool().query(
      `UPDATE client_companies SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
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
