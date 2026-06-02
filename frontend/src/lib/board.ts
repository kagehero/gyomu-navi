import type { AuthedUser } from "@/lib/auth/guards";

/**
 * SQL fragment + params restricting a `site_id` column to the sites the user
 * is allowed to interact with (read posts / submit posts).
 *
 *   admin    : all live sites
 *   manager  : sites under clients assigned to staff in the manager's department
 *   employee : all sites under assigned clients
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
        SELECT s.id
          FROM sites s
          JOIN staff_client_assigns sca ON sca.client_id = s.client_id
         WHERE sca.staff_id = $${paramOffset + 1}
           AND s.deleted_at IS NULL
      )`,
      params: [user.staffId],
    };
  }
  return {
    sql: ` AND ${siteIdColumn} IN (
      SELECT s.id
        FROM sites s
        JOIN staff_client_assigns sca ON sca.client_id = s.client_id
        JOIN staffs st ON st.id = sca.staff_id
       WHERE st.department_id = $${paramOffset + 1}
         AND st.deleted_at IS NULL
         AND s.deleted_at IS NULL
    )`,
    params: [user.departmentId],
  };
}
