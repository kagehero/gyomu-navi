/**
 * Staff visibility for sales reporting: business lines, clients, sites, tasks.
 */
import type { AuthedUser } from "@/lib/auth/guards";
import type { Pool, PoolClient } from "pg";

type Queryable = Pool | PoolClient;

/** Business lines visible to the current user. */
export async function visibleBusinessLineIds(
  db: Queryable,
  user: AuthedUser,
): Promise<string[] | null> {
  if (user.role === "admin") return null;

  if (user.role === "employee") {
    if (!user.staffId) return [];
    const { rows } = await db.query<{ business_line_id: string }>(
      `SELECT business_line_id FROM staff_business_line_assigns WHERE staff_id = $1`,
      [user.staffId],
    );
    return rows.map((r) => r.business_line_id);
  }

  const { rows } = await db.query<{ business_line_id: string }>(
    `SELECT DISTINCT cbl.business_line_id
       FROM staffs st
       JOIN staff_client_assigns sca ON sca.staff_id = st.id
       JOIN client_business_lines cbl ON cbl.client_id = sca.client_id
      WHERE st.department_id = $1 AND st.deleted_at IS NULL`,
    [user.departmentId],
  );
  return rows.map((r) => r.business_line_id);
}

/** Client IDs the user may report for within a business line. */
export async function visibleClientIdsForLine(
  db: Queryable,
  user: AuthedUser,
  businessLineId: string,
): Promise<string[] | null> {
  if (user.role === "admin") {
    const { rows } = await db.query<{ client_id: string }>(
      `SELECT client_id FROM client_business_lines WHERE business_line_id = $1`,
      [businessLineId],
    );
    return rows.map((r) => r.client_id);
  }

  if (user.role === "employee") {
    if (!user.staffId) return [];
    const { rows } = await db.query<{ client_id: string }>(
      `SELECT sca.client_id
         FROM staff_client_assigns sca
         JOIN client_business_lines cbl
           ON cbl.client_id = sca.client_id AND cbl.business_line_id = $2
        WHERE sca.staff_id = $1`,
      [user.staffId, businessLineId],
    );
    return rows.map((r) => r.client_id);
  }

  const { rows } = await db.query<{ client_id: string }>(
    `SELECT DISTINCT sca.client_id
       FROM staffs st
       JOIN staff_client_assigns sca ON sca.staff_id = st.id
       JOIN client_business_lines cbl
         ON cbl.client_id = sca.client_id AND cbl.business_line_id = $2
      WHERE st.department_id = $1 AND st.deleted_at IS NULL`,
    [user.departmentId, businessLineId],
  );
  return rows.map((r) => r.client_id);
}

/**
 * Site IDs for a client the user may use.
 * Employees with a client assignment get all live sites under that client.
 */
export async function visibleSiteIdsForClient(
  db: Queryable,
  user: AuthedUser,
  clientId: string,
): Promise<string[] | null> {
  if (user.role === "admin") {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM sites WHERE client_id = $1 AND deleted_at IS NULL`,
      [clientId],
    );
    return rows.map((r) => r.id);
  }

  if (user.role === "employee") {
    if (!user.staffId) return [];
    const { rows: assignRows } = await db.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM staff_client_assigns
          WHERE staff_id = $1 AND client_id = $2
       ) AS ok`,
      [user.staffId, clientId],
    );
    if (!assignRows[0]?.ok) return [];

    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM sites WHERE client_id = $1 AND deleted_at IS NULL ORDER BY name`,
      [clientId],
    );
    return rows.map((r) => r.id);
  }

  const { rows } = await db.query<{ id: string }>(
    `SELECT DISTINCT s.id
       FROM sites s
       JOIN staff_client_assigns sca ON sca.client_id = s.client_id
       JOIN staffs st ON st.id = sca.staff_id
      WHERE s.client_id = $1 AND s.deleted_at IS NULL
        AND st.department_id = $2 AND st.deleted_at IS NULL`,
    [clientId, user.departmentId],
  );
  return rows.map((r) => r.id);
}

/** Whether an employee may use a site (via assigned client). */
export async function employeeHasSiteAccess(
  db: Queryable,
  staffId: string,
  siteId: string,
): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM sites s
         JOIN staff_client_assigns sca
           ON sca.client_id = s.client_id AND sca.staff_id = $1
        WHERE s.id = $2 AND s.deleted_at IS NULL
     ) AS ok`,
    [staffId, siteId],
  );
  return rows[0]?.ok ?? false;
}

export async function employeeHasBusinessLine(
  db: Queryable,
  staffId: string,
  businessLineId: string,
): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM staff_business_line_assigns
        WHERE staff_id = $1 AND business_line_id = $2
     ) AS ok`,
    [staffId, businessLineId],
  );
  return rows[0]?.ok ?? false;
}

export async function employeeHasClient(
  db: Queryable,
  staffId: string,
  clientId: string,
): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM staff_client_assigns WHERE staff_id = $1 AND client_id = $2
     ) AS ok`,
    [staffId, clientId],
  );
  return rows[0]?.ok ?? false;
}
