import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getPool } from "@/lib/db/pool";
import { handleRouteError, parseJsonBody } from "@/lib/api/errors";

export const runtime = "nodejs";

type DepartmentRow = {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { rows } = await getPool().query<DepartmentRow>(
      `SELECT id, name, created_at, updated_at
         FROM departments
        WHERE deleted_at IS NULL
        ORDER BY name`,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "名称を入力してください").max(100),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await parseJsonBody(request);
    const { name } = createSchema.parse(body);
    const { rows } = await getPool().query<DepartmentRow>(
      `INSERT INTO departments (name)
       VALUES ($1)
       RETURNING id, name, created_at, updated_at`,
      [name],
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
