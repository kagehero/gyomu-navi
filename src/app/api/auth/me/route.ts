import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { getAuthedUserIdFromRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const id = getAuthedUserIdFromRequest(request);
  if (!id) {
    /** 200 + null avoids browser console treating "no session" as a failed fetch. */
    return NextResponse.json({ user: null });
  }
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    app_role: "admin" | "manager" | "employee";
    staff_id: string | null;
    department_id: string | null;
  }>(
    `SELECT id, email, display_name, app_role, staff_id, department_id
       FROM users
      WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.app_role,
      staffId: row.staff_id,
      departmentId: row.department_id,
    },
  });
}
