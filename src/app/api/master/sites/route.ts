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

const createSchema = z.object({
  client_id: z.string().uuid("顧客を選択してください"),
  name: z.string().trim().min(1, "拠点名を入力してください").max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius_m: z.number().int().positive().max(100_000),
  is_billing_branch: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { rows } = await getPool().query(
      `${SELECT_SITE} WHERE s.deleted_at IS NULL ORDER BY c.name, s.name`,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request);
    const v = createSchema.parse(body);
    const { rows } = await getPool().query(
      `WITH inserted AS (
         INSERT INTO sites (client_id, name, latitude, longitude, radius_m, is_billing_branch)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
         RETURNING id
       )
       ${SELECT_SITE}
       JOIN inserted i ON i.id = s.id`,
      [
        v.client_id,
        v.name,
        v.latitude,
        v.longitude,
        v.radius_m,
        v.is_billing_branch ?? true,
      ],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
