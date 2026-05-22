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

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { rows } = await getPool().query<ClientRow>(
      `SELECT id, name, code, created_at, updated_at
         FROM client_companies
        WHERE deleted_at IS NULL
        ORDER BY code`,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "企業名を入力してください").max(255),
  code: z.string().trim().min(1, "コードを入力してください").max(20),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request);
    const { name, code } = createSchema.parse(body);
    const { rows } = await getPool().query<ClientRow>(
      `INSERT INTO client_companies (name, code)
       VALUES ($1, $2)
       RETURNING id, name, code, created_at, updated_at`,
      [name, code],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
