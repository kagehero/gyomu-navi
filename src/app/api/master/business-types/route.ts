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

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const clientId = url.searchParams.get("client_id");
    const params: unknown[] = [];
    let where = `bt.deleted_at IS NULL`;
    if (clientId) {
      params.push(clientId);
      where += ` AND bt.client_id = $${params.length}`;
    }
    const { rows } = await getPool().query<BusinessTypeRow>(
      `SELECT bt.id, bt.client_id, c.name AS client_name, bt.name,
              bt.created_at, bt.updated_at
         FROM business_types bt
         JOIN client_companies c ON c.id = bt.client_id
        WHERE ${where}
        ORDER BY c.code, bt.name`,
      params,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  client_id: z.string().uuid("顧客企業を選択してください"),
  name: z.string().trim().min(1, "業務名を入力してください").max(100),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request);
    const v = createSchema.parse(body);
    const { rows } = await getPool().query<BusinessTypeRow>(
      `WITH inserted AS (
         INSERT INTO business_types (client_id, name)
         VALUES ($1, $2)
         RETURNING id, client_id, name, created_at, updated_at
       )
       SELECT i.*, c.name AS client_name
         FROM inserted i
         JOIN client_companies c ON c.id = i.client_id`,
      [v.client_id, v.name],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
