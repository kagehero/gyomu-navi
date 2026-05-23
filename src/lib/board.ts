import type { AuthedUser } from "@/lib/auth/guards";

/**
 * SQL fragment + params restricting a `site_id` column to the sites the user
 * is allowed to interact with (read posts / submit posts).
 *
 *   admin    : all live sites
 *   manager  : sites where some staff in the manager's department is assigned
 *   employee : sites the employee is assigned to
 *
 * Returned as `AND <site_id_col> IN (...)` so the caller can append it.
 */
export function visibleSitesClause(
  user: AuthedUser,
  siteIdColumn: string,
  paramOffset: number,
): { sql: string; params: unknown[] } {
  if (user.role === "admin") {
    return { sql: "", params: [] };
  }
  if (user.role === "employee") {
    return {
      sql: ` AND ${siteIdColumn} IN (
        SELECT site_id FROM staff_site_assigns WHERE staff_id = $${paramOffset + 1}
      )`,
      params: [user.staffId],
    };
  }
  // manager
  return {
    sql: ` AND ${siteIdColumn} IN (
      SELECT ssa.site_id
        FROM staff_site_assigns ssa
        JOIN staffs st ON st.id = ssa.staff_id
       WHERE st.department_id = $${paramOffset + 1}
         AND st.deleted_at IS NULL
    )`,
    params: [user.departmentId],
  };
}
