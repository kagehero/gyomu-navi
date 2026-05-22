import type { NextRequest } from "next/server";
import { getPool } from "@/lib/db/pool";
import { getAuthedUserIdFromRequest } from "./session";

export type AppRole = "admin" | "manager" | "employee";

export type AuthedUser = {
  id: string;
  email: string;
  role: AppRole;
  staffId: string | null;
  departmentId: string | null;
};

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Look up the authenticated user (with role/staff/department) for the request,
 * or throw AuthError(401) if the session is missing/invalid. The pool query is
 * a single round-trip and the result is intentionally not cached per-request.
 */
export async function requireUser(request: NextRequest): Promise<AuthedUser> {
  const id = getAuthedUserIdFromRequest(request);
  if (!id) throw new AuthError(401, "認証が必要です");

  const { rows } = await getPool().query<{
    id: string;
    email: string;
    app_role: AppRole;
    staff_id: string | null;
    department_id: string | null;
    deleted_at: Date | null;
  }>(
    `SELECT id, email, app_role, staff_id, department_id, deleted_at
       FROM users
      WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row || row.deleted_at) throw new AuthError(401, "認証が必要です");

  return {
    id: row.id,
    email: row.email,
    role: row.app_role,
    staffId: row.staff_id,
    departmentId: row.department_id,
  };
}

export async function requireAdmin(request: NextRequest): Promise<AuthedUser> {
  const user = await requireUser(request);
  if (user.role !== "admin") {
    throw new AuthError(403, "この操作には管理者権限が必要です");
  }
  return user;
}
