import type { AuthedUser } from "../auth/types";

/**
 * "Notices visible to this user" — SQL fragment + params, identical to the
 * Phase1 helper in `frontend/src/lib/notices.ts`. The non-admin clause
 * resolves the caller's department on the fly via users LEFT JOIN staffs so
 * the same fragment works for both managers and employees.
 */
export function visibilityClause(
  user: AuthedUser,
  paramOffset: number,
): { sql: string; params: unknown[] } {
  if (user.role === "admin") {
    return { sql: "TRUE", params: [] };
  }
  const sql = `(
    n.from_user_id = $${paramOffset + 1}
    OR n.target_type = 'all'
    OR (n.target_type = 'individual' AND n.target_user_id = $${paramOffset + 1})
    OR (n.target_type = 'department'  AND n.target_department_id = (
          SELECT COALESCE(u.department_id, st.department_id)
            FROM users u
            LEFT JOIN staffs st ON st.id = u.staff_id
           WHERE u.id = $${paramOffset + 1}
        )
       )
  )`;
  return { sql, params: [user.id] };
}

/**
 * SELECT prefix. Requires `$1 = current user id` (used by the is_read
 * subselect). Caller appends the rest of the WHERE / ORDER BY clause.
 */
export const SELECT_NOTICE_PREFIX = `
  SELECT n.id,
         n.from_user_id, fu.display_name AS from_display_name,
         n.target_type,
         n.target_department_id,
         dep.name AS target_department_name,
         n.target_user_id,
         tu.display_name AS target_user_display_name,
         n.client_id,
         cc.name AS client_name,
         n.title, n.body, n.created_at, n.updated_at,
         EXISTS (
           SELECT 1 FROM notice_reads nr
            WHERE nr.notice_id = n.id AND nr.user_id = $1
         ) AS is_read,
         (
           SELECT count(*)::int FROM notice_reads nr WHERE nr.notice_id = n.id
         ) AS read_count,
         CASE n.target_type
           WHEN 'individual' THEN 1
           WHEN 'department' THEN (
             SELECT count(*)::int
               FROM users u
               JOIN staffs st ON st.id = u.staff_id
              WHERE u.app_role = 'employee'
                AND u.deleted_at IS NULL
                AND st.deleted_at IS NULL
                AND st.department_id = n.target_department_id
           )
           WHEN 'all' THEN (
             SELECT count(*)::int
               FROM users u
              WHERE u.app_role = 'employee' AND u.deleted_at IS NULL
           )
         END AS total_target
    FROM notices n
    JOIN users fu ON fu.id = n.from_user_id
    LEFT JOIN departments dep ON dep.id = n.target_department_id
    LEFT JOIN users tu ON tu.id = n.target_user_id
    LEFT JOIN client_companies cc ON cc.id = n.client_id
`;
