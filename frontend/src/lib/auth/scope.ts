import { getPool } from "@/lib/db/pool";
import type { AuthedUser } from "./guards";

/**
 * SQL WHERE fragment + params that restrict a staff_id column to what the
 * given user is allowed to see.
 *
 *   admin    : no restriction
 *   manager  : only staff in their department
 *   employee : only themselves
 *
 * Callers should append the returned fragment to their WHERE and pass the
 * params after their own. The placeholder offset lets the fragment slot in
 * after the caller's existing $N placeholders.
 */
export function staffScopeWhere(
  user: AuthedUser,
  staffIdColumn: string,
  placeholderOffset: number,
): { sql: string; params: unknown[] } {
  if (user.role === "admin") {
    return { sql: "", params: [] };
  }
  if (user.role === "employee") {
    return {
      sql: ` AND ${staffIdColumn} = $${placeholderOffset + 1}`,
      params: [user.staffId],
    };
  }
  // manager
  return {
    sql: ` AND ${staffIdColumn} IN (
             SELECT id FROM staffs
              WHERE department_id = $${placeholderOffset + 1}
                AND deleted_at IS NULL
           )`,
    params: [user.departmentId],
  };
}

/**
 * Check whether the user can act on the given staff_id at all (read scope).
 * Used by routes that resolve to a single record rather than a filtered list.
 */
export async function canAccessStaff(
  user: AuthedUser,
  staffId: string,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "employee") return user.staffId === staffId;
  // manager: target staff must be in user's department
  const { rows } = await getPool().query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM staffs
        WHERE id = $1 AND department_id = $2 AND deleted_at IS NULL
     ) AS exists`,
    [staffId, user.departmentId],
  );
  return rows[0]?.exists ?? false;
}
