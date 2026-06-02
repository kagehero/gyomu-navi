import type { AuthedUser } from "./types";

/**
 * SQL WHERE fragment + params that restrict a staff_id column to what the
 * given user is allowed to see. Direct port of Phase1 `staffScopeWhere` in
 * frontend/src/lib/auth/scope.ts — kept byte-for-byte compatible so the
 * generated SQL matches the legacy implementation.
 *
 *   admin    : no restriction
 *   manager  : only staff in their department
 *   employee : only themselves
 *
 * Callers should append `result.sql` to their WHERE and pass `result.params`
 * after their own. `placeholderOffset` lets the fragment slot in after the
 * caller's existing $N placeholders.
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
 * JST calendar date for a given UTC instant (default now), formatted as
 * `YYYY-MM-DD` — matches the legacy `jstWorkDate()` helper used to bucket
 * attendance and report rows.
 */
export function jstWorkDate(at: Date = new Date()): string {
  const ms = at.getTime() + 9 * 3600_000;
  return new Date(ms).toISOString().slice(0, 10);
}
