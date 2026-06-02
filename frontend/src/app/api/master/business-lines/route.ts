import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { rows } = await getPool().query(
      `SELECT id, name, sort_order
         FROM business_lines
        WHERE deleted_at IS NULL
        ORDER BY sort_order, name`,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "部門名を入力してください").max(100),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request);
    const v = createSchema.parse(body);
    const { rows } = await getPool().query(
      `INSERT INTO business_lines (name, sort_order)
       VALUES ($1, COALESCE($2, 0))
       RETURNING id, name, sort_order`,
      [v.name, v.sort_order ?? 0],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
