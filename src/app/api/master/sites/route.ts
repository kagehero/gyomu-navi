import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

type SiteRow = {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  created_at: Date;
  updated_at: Date;
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { rows } = await getPool().query<SiteRow>(
      `SELECT s.id, s.client_id, c.name AS client_name,
              s.name,
              s.latitude::float8  AS latitude,
              s.longitude::float8 AS longitude,
              s.radius_m,
              s.created_at, s.updated_at
         FROM sites s
         JOIN client_companies c ON c.id = s.client_id
        WHERE s.deleted_at IS NULL
        ORDER BY c.code, s.name`,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  client_id: z.string().uuid("顧客企業を選択してください"),
  name: z.string().trim().min(1, "現場名を入力してください").max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius_m: z.number().int().positive().max(100_000),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request);
    const v = createSchema.parse(body);
    const { rows } = await getPool().query<SiteRow>(
      `WITH inserted AS (
         INSERT INTO sites (client_id, name, latitude, longitude, radius_m)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, client_id, name, latitude, longitude, radius_m,
                   created_at, updated_at
       )
       SELECT i.id, i.client_id, i.name,
              i.latitude::float8  AS latitude,
              i.longitude::float8 AS longitude,
              i.radius_m, i.created_at, i.updated_at,
              c.name AS client_name
         FROM inserted i
         JOIN client_companies c ON c.id = i.client_id`,
      [v.client_id, v.name, v.latitude, v.longitude, v.radius_m],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
