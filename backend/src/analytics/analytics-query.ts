import { staffScopeWhere } from "../auth/scope";
import type { AuthedUser } from "../auth/types";

/** JST work date used for bucketing and filters. */
export const WORK_DATE_SQL = `COALESCE(rs.work_date, (r.reported_at AT TIME ZONE 'Asia/Tokyo')::date)`;

export const REPORTS_FROM_SQL = `
  FROM business_reports r
  JOIN staffs s ON s.id = r.staff_id AND s.deleted_at IS NULL
  JOIN sites st ON st.id = r.site_id AND st.deleted_at IS NULL
  JOIN client_companies c ON c.id = r.client_id AND c.deleted_at IS NULL
  JOIN business_types bt ON bt.id = r.business_type_id AND bt.deleted_at IS NULL
  LEFT JOIN report_sessions rs ON rs.id = r.session_id
  LEFT JOIN business_lines bl ON bl.id = rs.business_line_id OR bl.id = bt.business_line_id
`;

export type RangeFilters = {
  date?: string;
  from?: string;
  to?: string;
  staff_id?: string;
  client_id?: string;
  site_id?: string;
};

export function revenueSelectSql(userIsAdmin: boolean): string {
  if (!userIsAdmin) {
    return `, NULL::float8 AS revenue_excl, NULL::float8 AS revenue_incl`;
  }
  return `,
         COALESCE(SUM(r.count * bt.unit_price_excl), 0)::float8 AS revenue_excl,
         COALESCE(SUM(r.count * bt.unit_price_incl), 0)::float8 AS revenue_incl`;
}

export function buildReportFilters(
  user: AuthedUser,
  filters: RangeFilters,
  opts: { salesOnly?: boolean } = { salesOnly: true },
): { whereSql: string; params: unknown[] } {
  const params: unknown[] = [];
  const conds: string[] = [];

  // #7 複数人拠点: individual (個人採算用) sessions never count as sales. Reports
  // with no session (rs.report_kind IS NULL) are legacy/solo and still count.
  if (opts.salesOnly !== false) {
    conds.push(`(rs.report_kind IS NULL OR rs.report_kind <> 'individual')`);
  }

  if (filters.date) {
    params.push(filters.date);
    conds.push(`${WORK_DATE_SQL} = $${params.length}::date`);
  } else {
    if (filters.from) {
      params.push(filters.from);
      conds.push(`${WORK_DATE_SQL} >= $${params.length}::date`);
    }
    if (filters.to) {
      params.push(filters.to);
      conds.push(`${WORK_DATE_SQL} <= $${params.length}::date`);
    }
  }
  if (filters.staff_id) {
    params.push(filters.staff_id);
    conds.push(`r.staff_id = $${params.length}`);
  }
  if (filters.client_id) {
    params.push(filters.client_id);
    conds.push(`r.client_id = $${params.length}`);
  }
  if (filters.site_id) {
    params.push(filters.site_id);
    conds.push(`r.site_id = $${params.length}`);
  }

  const scope = staffScopeWhere(user, "r.staff_id", params.length);
  params.push(...scope.params);
  if (scope.sql) conds.push(scope.sql.replace(/^ AND /, ""));

  return {
    whereSql: conds.length ? `WHERE ${conds.join(" AND ")}` : "",
    params,
  };
}

export function resolveRange(filters: RangeFilters, fallbackDays = 6): {
  from: string;
  to: string;
} {
  if (filters.date) {
    return { from: filters.date, to: filters.date };
  }
  if (filters.from && filters.to) {
    return { from: filters.from, to: filters.to };
  }
  if (filters.from) {
    return { from: filters.from, to: filters.from };
  }
  if (filters.to) {
    return { from: filters.to, to: filters.to };
  }
  const to = jstWorkDate();
  const from = jstWorkDate(new Date(Date.now() - fallbackDays * 86_400_000));
  return { from, to };
}

export function jstWorkDate(at: Date = new Date()): string {
  const ms = at.getTime() + 9 * 3600_000;
  return new Date(ms).toISOString().slice(0, 10);
}
