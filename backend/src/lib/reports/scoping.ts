import { DataSource, QueryRunner } from "typeorm";
import type { AuthedUser } from "../../auth/types";

/**
 * Either the long-lived pool (DataSource) or a single transaction
 * (QueryRunner) — both expose a `.query(sql, params)` method with the same
 * signature as the Phase1 `Pool | PoolClient` Queryable.
 */
type Queryable = Pick<DataSource, "query"> | Pick<QueryRunner, "query">;

/**
 * Visibility helpers ported from Phase1 `frontend/src/lib/reports/scoping.ts`.
 *
 * Return value convention (preserved from Phase1):
 *   - `null`       — caller should impose no restriction (admin)
 *   - `string[]`   — explicit allow-list, possibly empty
 *
 * Pass the result through `ANY($n::uuid[])` for SQL filtering, or check
 * empty-array first to short-circuit to no results.
 */

export async function visibleBusinessLineIds(
  ds: Queryable,
  user: AuthedUser,
): Promise<string[] | null> {
  if (user.role === "admin") return null;

  if (user.role === "employee") {
    if (!user.staffId) return [];
    const rows: Array<{ business_line_id: string }> = await ds.query(
      `SELECT business_line_id FROM staff_business_line_assigns WHERE staff_id = $1`,
      [user.staffId],
    );
    return rows.map((r) => r.business_line_id);
  }

  // manager
  const rows: Array<{ business_line_id: string }> = await ds.query(
    `SELECT DISTINCT cbl.business_line_id
       FROM staffs st
       JOIN staff_client_assigns sca ON sca.staff_id = st.id
       JOIN client_business_lines cbl ON cbl.client_id = sca.client_id
      WHERE st.department_id = $1 AND st.deleted_at IS NULL`,
    [user.departmentId],
  );
  return rows.map((r) => r.business_line_id);
}

export async function visibleClientIdsForLine(
  ds: Queryable,
  user: AuthedUser,
  businessLineId: string,
): Promise<string[] | null> {
  if (user.role === "admin") {
    const rows: Array<{ client_id: string }> = await ds.query(
      `SELECT client_id FROM client_business_lines WHERE business_line_id = $1`,
      [businessLineId],
    );
    return rows.map((r) => r.client_id);
  }

  if (user.role === "employee") {
    if (!user.staffId) return [];
    const rows: Array<{ client_id: string }> = await ds.query(
      `SELECT sca.client_id
         FROM staff_client_assigns sca
         JOIN client_business_lines cbl
           ON cbl.client_id = sca.client_id AND cbl.business_line_id = $2
        WHERE sca.staff_id = $1`,
      [user.staffId, businessLineId],
    );
    return rows.map((r) => r.client_id);
  }

  const rows: Array<{ client_id: string }> = await ds.query(
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

export async function visibleSiteIdsForClient(
  ds: Queryable,
  user: AuthedUser,
  clientId: string,
): Promise<string[] | null> {
  if (user.role === "admin") {
    const rows: Array<{ id: string }> = await ds.query(
      `SELECT id FROM sites WHERE client_id = $1 AND deleted_at IS NULL`,
      [clientId],
    );
    return rows.map((r) => r.id);
  }

  if (user.role === "employee") {
    if (!user.staffId) return [];
    const assignRows: Array<{ ok: boolean }> = await ds.query(
      `SELECT EXISTS (
         SELECT 1 FROM staff_client_assigns
          WHERE staff_id = $1 AND client_id = $2
       ) AS ok`,
      [user.staffId, clientId],
    );
    if (!assignRows[0]?.ok) return [];

    const rows: Array<{ id: string }> = await ds.query(
      `SELECT id FROM sites WHERE client_id = $1 AND deleted_at IS NULL ORDER BY name`,
      [clientId],
    );
    return rows.map((r) => r.id);
  }

  const rows: Array<{ id: string }> = await ds.query(
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

export async function employeeHasSiteAccess(
  ds: Queryable,
  staffId: string,
  siteId: string,
): Promise<boolean> {
  const rows: Array<{ ok: boolean }> = await ds.query(
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
  ds: Queryable,
  staffId: string,
  businessLineId: string,
): Promise<boolean> {
  const rows: Array<{ ok: boolean }> = await ds.query(
    `SELECT EXISTS (
       SELECT 1 FROM staff_business_line_assigns
        WHERE staff_id = $1 AND business_line_id = $2
     ) AS ok`,
    [staffId, businessLineId],
  );
  return rows[0]?.ok ?? false;
}

export async function employeeHasClient(
  ds: Queryable,
  staffId: string,
  clientId: string,
): Promise<boolean> {
  const rows: Array<{ ok: boolean }> = await ds.query(
    `SELECT EXISTS (
       SELECT 1 FROM staff_client_assigns WHERE staff_id = $1 AND client_id = $2
     ) AS ok`,
    [staffId, clientId],
  );
  return rows[0]?.ok ?? false;
}
