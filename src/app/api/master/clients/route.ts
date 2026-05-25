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

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { rows } = await getPool().query(
      `SELECT c.id, c.name, c.code, c.created_at, c.updated_at,
              COALESCE(
                ARRAY_AGG(cbl.business_line_id) FILTER (WHERE cbl.business_line_id IS NOT NULL),
                ARRAY[]::uuid[]
              ) AS business_line_ids
         FROM client_companies c
         LEFT JOIN client_business_lines cbl ON cbl.client_id = c.id
        WHERE c.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY c.code`,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "企業名を入力してください").max(255),
  code: z.string().trim().min(1, "コードを入力してください").max(20),
  business_line_ids: z.array(z.string().uuid()).default([]),
});

export async function POST(request: NextRequest) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request);
    const v = createSchema.parse(body);
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO client_companies (name, code)
       VALUES ($1, $2)
       RETURNING id, name, code, created_at, updated_at`,
      [v.name, v.code],
    );
    const item = rows[0]!;
    await syncClientBusinessLines(client, item.id, v.business_line_ids);
    await client.query("COMMIT");
    return NextResponse.json(
      { item: { ...item, business_line_ids: v.business_line_ids } },
      { status: 201 },
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return handleRouteError(err);
  } finally {
    client.release();
  }
}
