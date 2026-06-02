import type { AuthedUser } from "@/lib/auth/guards";

export type NoticeRow = {
  id: string;
  from_user_id: string;
  from_display_name: string;
  target_type: "all" | "department" | "individual";
  target_department_id: string | null;
  target_department_name: string | null;
  target_user_id: string | null;
  target_user_display_name: string | null;
  client_id: string | null;
  client_name: string | null;
  title: string;
  body: string;
  created_at: Date;
  updated_at: Date;
  is_read: boolean;
  read_count: number;
  total_target: number;
};

/**
 * "Notices visible to this user". Used by both the list endpoint and the
 * detail endpoint, kept here so they can't drift.
 *
 *   admin    : everything
 *   others   : own + all-broadcast + own dept-broadcast + own individual
 *
 * For non-admins the "own department" is resolved at query time via a
 * subquery over users LEFT JOIN staffs (so we don't have to know whether the
 * caller is a manager or an employee here).
 *
 * Returns a fragment intended to be substituted into WHERE, plus the params
 * to push *after* the caller's existing params. `paramOffset` is the count
 * of placeholders the caller has already used.
 */
export function visibilityClause(user: AuthedUser, paramOffset: number): {
  sql: string;
  params: unknown[];
} {
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
 * SELECT prefix for notice rows. Requires `$1 = current user id` (for the
 * is_read computation) and is followed by the caller's WHERE / ORDER BY.
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
