import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { getAuthedUserIdFromRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const id = getAuthedUserIdFromRequest(request);
  if (!id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    app_role: string;
    staff_profile_id: string | null;
  }>(`SELECT id, email, display_name, app_role, staff_profile_id FROM users WHERE id = $1`, [id]);
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 401 });
  }
  if (row.app_role !== "admin" && row.app_role !== "employee") {
    return NextResponse.json({ error: "不正なアカウント役割" }, { status: 500 });
  }
  return NextResponse.json({
    user: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.app_role,
      staffId: row.staff_profile_id,
    },
  });
}
