import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { jstWorkDate, staffScopeWhere } from "../auth/scope";
import type { AuthedUser } from "../auth/types";
import { AttendanceService } from "../attendance/attendance.service";
import {
  buildReportFilters,
  REPORTS_FROM_SQL,
  resolveRange,
  revenueSelectSql,
  WORK_DATE_SQL,
  type RangeFilters,
} from "./analytics-query";
import { csvRow, csvWithBom } from "./csv";
import type { CsvExportQueryDto } from "./dto";

export type AggregationRow = {
  period_key: string;
  period_start?: string;
  period_end?: string;
  report_count: number;
  total_count: number;
  revenue_excl: number | null;
  revenue_incl: number | null;
  dimension_id?: string;
  dimension_name?: string;
  /** Worked hours (staff dimension only) and per-hour productivity. */
  worked_hours?: number | null;
  count_per_hour?: number | null;
  revenue_excl_per_hour?: number | null;
  /** External (派遣) labour cost and resulting profit. Admin only. */
  dispatch_labor_cost?: number | null;
  profit_excl?: number | null;
};

export type Dimension = "client" | "staff" | "site" | "business_line";

/** Sort keys usable for ranking dimension aggregations. */
export type SortKey =
  | "total_count"
  | "revenue_excl"
  | "report_count"
  | "count_per_hour"
  | "revenue_excl_per_hour"
  | "dimension_name";

const SORT_COLUMNS: Record<SortKey, string> = {
  total_count: "total_count",
  revenue_excl: "revenue_excl",
  report_count: "report_count",
  count_per_hour: "count_per_hour",
  revenue_excl_per_hour: "revenue_excl_per_hour",
  dimension_name: "dimension_name",
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly attendance: AttendanceService,
  ) {}

  async daily(user: AuthedUser, filters: RangeFilters) {
    const items = await this.aggregateByPeriod(user, filters, "daily");
    return { items, range: resolveRange(filters) };
  }

  async weekly(user: AuthedUser, filters: RangeFilters) {
    const items = await this.aggregateByPeriod(user, filters, "weekly");
    return { items, range: resolveRange(filters) };
  }

  async monthly(user: AuthedUser, filters: RangeFilters) {
    const items = await this.aggregateByPeriod(user, filters, "monthly");
    return { items, range: resolveRange(filters) };
  }

  async byClient(user: AuthedUser, filters: RangeFilters, sort?: { key: SortKey; dir: "asc" | "desc" }) {
    const items = await this.aggregateByDimension(user, filters, "client", sort);
    return { items, range: resolveRange(filters) };
  }

  async byStaff(user: AuthedUser, filters: RangeFilters, sort?: { key: SortKey; dir: "asc" | "desc" }) {
    const items = await this.aggregateByDimension(user, filters, "staff", sort);
    return { items, range: resolveRange(filters) };
  }

  async bySite(user: AuthedUser, filters: RangeFilters, sort?: { key: SortKey; dir: "asc" | "desc" }) {
    const items = await this.aggregateByDimension(user, filters, "site", sort);
    return { items, range: resolveRange(filters) };
  }

  async byBusinessLine(user: AuthedUser, filters: RangeFilters, sort?: { key: SortKey; dir: "asc" | "desc" }) {
    const items = await this.aggregateByDimension(user, filters, "business_line", sort);
    return { items, range: resolveRange(filters) };
  }

  async dashboard(user: AuthedUser, date?: string) {
    const anchor = date ?? jstWorkDate();
    const weekStart = jstWorkDate(new Date(Date.parse(`${anchor}T00:00:00+09:00`) - 6 * 86_400_000));

    const [todayReports, weeklyTrend, byClient, attendance] = await Promise.all([
      this.aggregateByPeriod(user, { date: anchor }, "daily"),
      this.aggregateByPeriod(user, { from: weekStart, to: anchor }, "daily"),
      user.role === "admin"
        ? this.aggregateByDimension(user, { from: weekStart, to: anchor }, "client")
        : Promise.resolve([]),
      this.attendance.stats(user, { date: anchor }),
    ]);

    const today = todayReports[0] ?? {
      period_key: anchor,
      report_count: 0,
      total_count: 0,
      revenue_excl: user.role === "admin" ? 0 : null,
      revenue_incl: user.role === "admin" ? 0 : null,
    };

    return {
      date: anchor,
      range: { from: weekStart, to: anchor },
      today,
      weekly_trend: weeklyTrend,
      by_client: byClient,
      attendance,
    };
  }

  async exportCsv(user: AuthedUser, q: CsvExportQueryDto): Promise<{ body: string; filename: string }> {
    const groupBy = q.group_by ?? "detail";
    const range = resolveRange(q, groupBy === "detail" ? 0 : 6);

    if (groupBy === "detail") {
      return this.exportDetailCsv(user, q, range);
    }

    let items: AggregationRow[];
    switch (groupBy) {
      case "daily":
        items = await this.aggregateByPeriod(user, q, "daily");
        break;
      case "weekly":
        items = await this.aggregateByPeriod(user, q, "weekly");
        break;
      case "monthly":
        items = await this.aggregateByPeriod(user, q, "monthly");
        break;
      case "client":
        items = await this.aggregateByDimension(user, q, "client");
        break;
      case "staff":
        items = await this.aggregateByDimension(user, q, "staff");
        break;
      case "site":
        items = await this.aggregateByDimension(user, q, "site");
        break;
      case "business_line":
        items = await this.aggregateByDimension(user, q, "business_line");
        break;
      default:
        items = [];
    }

    const admin = user.role === "admin";
    const header = admin
      ? ["期間/名称", "報告件数", "総数量", "売上(税抜)", "売上(税込)"]
      : ["期間/名称", "報告件数", "総数量"];

    const rows = [
      csvRow(header),
      ...items.map((r) =>
        csvRow([
          r.dimension_name ?? r.period_key,
          r.report_count,
          r.total_count,
          ...(admin ? [r.revenue_excl ?? 0, r.revenue_incl ?? 0] : []),
        ]),
      ),
    ];

    return {
      body: csvWithBom(rows),
      filename: `reports_${groupBy}_${range.from}_${range.to}.csv`,
    };
  }

  private async exportDetailCsv(
    user: AuthedUser,
    filters: RangeFilters,
    range: { from: string; to: string },
  ): Promise<{ body: string; filename: string }> {
    const admin = user.role === "admin";
    const { whereSql, params } = buildReportFilters(user, {
      ...filters,
      from: filters.date ? undefined : range.from,
      to: filters.date ? undefined : range.to,
      date: filters.date,
    });

    const priceCols = admin
      ? `bt.unit_price_excl::float8 AS unit_price_excl,
         bt.unit_price_incl::float8 AS unit_price_incl,
         (r.count * bt.unit_price_excl)::float8 AS line_amount_excl,
         (r.count * bt.unit_price_incl)::float8 AS line_amount_incl`
      : "";

    const rows = await this.ds.query(
      `SELECT ${WORK_DATE_SQL}::text AS work_date,
              rs.submitted_at,
              s.name AS staff_name,
              bl.name AS business_line_name,
              c.name AS client_name,
              st.name AS site_name,
              bt.name AS business_type_name,
              r.count,
              ${admin ? priceCols + "," : ""}
              rs.memo AS session_memo,
              r.memo
         ${REPORTS_FROM_SQL}
         ${whereSql}
         ORDER BY ${WORK_DATE_SQL} DESC, rs.submitted_at DESC NULLS LAST, c.name, st.name
         LIMIT 10000`,
      params,
    );

    const header = admin
      ? [
          "作業日",
          "提出日時",
          "スタッフ",
          "部門",
          "顧客",
          "拠点",
          "業務内容",
          "数量",
          "単価(税抜)",
          "単価(税込)",
          "金額(税抜)",
          "金額(税込)",
          "日次メモ",
          "明細メモ",
        ]
      : ["作業日", "提出日時", "スタッフ", "部門", "顧客", "拠点", "業務内容", "数量", "日次メモ", "明細メモ"];

    const lines = [
      csvRow(header),
      ...rows.map((r: Record<string, unknown>) => {
        const submitted = r.submitted_at
          ? new Date(String(r.submitted_at)).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
          : "";
        return csvRow([
          r.work_date,
          submitted,
          r.staff_name,
          r.business_line_name ?? "",
          r.client_name,
          r.site_name,
          r.business_type_name,
          r.count,
          ...(admin
            ? [r.unit_price_excl, r.unit_price_incl, r.line_amount_excl, r.line_amount_incl]
            : []),
          r.session_memo ?? "",
          r.memo ?? "",
        ]);
      }),
    ];

    return {
      body: csvWithBom(lines),
      filename: `reports_detail_${range.from}_${range.to}.csv`,
    };
  }

  private async aggregateByPeriod(
    user: AuthedUser,
    filters: RangeFilters,
    mode: "daily" | "weekly" | "monthly",
  ): Promise<AggregationRow[]> {
    const { whereSql, params } = buildReportFilters(user, filters);
    const admin = user.role === "admin";

    let periodKey: string;
    let groupBy: string;
    let extraSelect = "";
    if (mode === "daily") {
      periodKey = `${WORK_DATE_SQL}::text`;
      groupBy = `${WORK_DATE_SQL}`;
    } else if (mode === "weekly") {
      periodKey = `to_char(${WORK_DATE_SQL}, 'IYYY-"W"IW')`;
      groupBy = periodKey;
      extraSelect = `, MIN(${WORK_DATE_SQL})::text AS period_start, MAX(${WORK_DATE_SQL})::text AS period_end`;
    } else {
      periodKey = `to_char(${WORK_DATE_SQL}, 'YYYY-MM')`;
      groupBy = periodKey;
      extraSelect = `, (${periodKey} || '-01')::date::text AS period_start`;
    }

    const rows: AggregationRow[] = await this.ds.query(
      `SELECT ${periodKey} AS period_key
              ${extraSelect},
              COUNT(*)::int AS report_count,
              COALESCE(SUM(r.count), 0)::float8 AS total_count
              ${revenueSelectSql(admin)}
         ${REPORTS_FROM_SQL}
         ${whereSql}
         GROUP BY ${groupBy}
         ORDER BY period_key`,
      params,
    );

    // Merge dispatch (派遣) labour cost into each period so 当日の収支 reflects it.
    // The labour period key formats rs.work_date the same way as periodKey.
    if (admin) {
      const laborKeyExpr =
        mode === "daily"
          ? "rs.work_date"
          : mode === "weekly"
            ? `to_char(rs.work_date, 'IYYY-"W"IW')`
            : `to_char(rs.work_date, 'YYYY-MM')`;
      const labor = await this.laborByKey(user, filters, laborKeyExpr);
      for (const row of rows) {
        const cost = labor.get(row.period_key) ?? 0;
        row.dispatch_labor_cost = cost;
        row.profit_excl = (row.revenue_excl ?? 0) - cost;
      }
    }

    return rows;
  }

  /**
   * Dispatch (派遣) labour cost grouped by a session dimension, for the same
   * range + scope as the report aggregation. Admin-only (cost/profit concern).
   * Returns a map from dimension id → total labour cost so callers can merge it
   * into their revenue rows and derive profit. Periods/dimensions that have no
   * dispatch entries simply don't appear in the map.
   */
  private async laborByKey(
    user: AuthedUser,
    filters: RangeFilters,
    keyExpr: string,
  ): Promise<Map<string, number>> {
    const range = resolveRange(filters);
    const params: unknown[] = [range.from, range.to];
    let where = `rs.work_date >= $1::date AND rs.work_date <= $2::date`;

    if (filters.staff_id) {
      params.push(filters.staff_id);
      where += ` AND rs.staff_id = $${params.length}`;
    }
    const scope = staffScopeWhere(user, "rs.staff_id", params.length);
    params.push(...scope.params);
    if (scope.sql) where += scope.sql;

    const rows: Array<{ k: string; cost: number }> = await this.ds.query(
      `SELECT ${keyExpr}::text AS k,
              COALESCE(SUM(dlc.labor_cost), 0)::float8 AS cost
         FROM dispatch_labor_costs dlc
         JOIN report_sessions rs ON rs.id = dlc.session_id
         JOIN staffs s ON s.id = rs.staff_id AND s.deleted_at IS NULL
         JOIN business_lines bl ON bl.id = rs.business_line_id
        WHERE ${where}
        GROUP BY ${keyExpr}`,
      params,
    );
    return new Map(rows.map((r) => [r.k, r.cost]));
  }

  private async aggregateByDimension(
    user: AuthedUser,
    filters: RangeFilters,
    dimension: Dimension,
    sort?: { key: SortKey; dir: "asc" | "desc" },
  ): Promise<AggregationRow[]> {
    const { whereSql, params } = buildReportFilters(user, filters);
    const admin = user.role === "admin";

    const dim =
      dimension === "client"
        ? { id: "c.id", name: "c.name" }
        : dimension === "staff"
          ? { id: "s.id", name: "s.name" }
          : dimension === "site"
            ? { id: "st.id", name: "st.name" }
            : { id: "bl.id", name: "bl.name" };

    // Per-hour productivity only makes sense for the staff dimension, where we
    // can attribute worked hours (from attendance_logs) to the grouping. For
    // other dimensions hours are NULL and the derived columns stay NULL.
    const isStaff = dimension === "staff";
    const range = resolveRange(filters);

    // Worked hours per staff over the same date window. Bound by the same
    // resolved range so it lines up with the report aggregation; punch_out NULL
    // rows (still working) contribute 0 hours.
    const hoursJoin = isStaff
      ? `LEFT JOIN (
           SELECT al.staff_id,
                  COALESCE(SUM(
                    EXTRACT(EPOCH FROM (al.punch_out_at - al.punch_in_at)) / 3600.0
                  ), 0)::float8 AS hours
             FROM attendance_logs al
            WHERE al.punch_out_at IS NOT NULL
              AND al.work_date >= $${params.length + 1}::date
              AND al.work_date <= $${params.length + 2}::date
            GROUP BY al.staff_id
         ) hrs ON hrs.staff_id = s.id`
      : "";
    const hoursParams = isStaff ? [range.from, range.to] : [];

    const hoursSelect = isStaff
      ? `, MAX(hrs.hours) AS worked_hours,
           CASE WHEN MAX(hrs.hours) > 0
                THEN (SUM(r.count) / MAX(hrs.hours))::float8 END AS count_per_hour
           ${admin
             ? `, CASE WHEN MAX(hrs.hours) > 0
                       THEN (SUM(r.count * bt.unit_price_excl) / MAX(hrs.hours))::float8 END
                  AS revenue_excl_per_hour`
             : `, NULL::float8 AS revenue_excl_per_hour`}`
      : `, NULL::float8 AS worked_hours,
           NULL::float8 AS count_per_hour,
           NULL::float8 AS revenue_excl_per_hour`;

    // Resolve the ORDER BY from a whitelist (never interpolate user input).
    const sortCol = sort ? SORT_COLUMNS[sort.key] : "total_count";
    const sortDir = sort?.dir === "asc" ? "ASC" : "DESC";

    const rows: AggregationRow[] = await this.ds.query(
      `SELECT ${dim.id}::text AS dimension_id,
              ${dim.name} AS dimension_name,
              ${dim.id}::text AS period_key,
              COUNT(*)::int AS report_count,
              COALESCE(SUM(r.count), 0)::float8 AS total_count
              ${revenueSelectSql(admin)}
              ${hoursSelect}
         ${REPORTS_FROM_SQL}
         ${hoursJoin}
         ${whereSql}
         GROUP BY ${dim.id}, ${dim.name}
         ORDER BY ${sortCol} ${sortDir} NULLS LAST, dimension_name`,
      [...params, ...hoursParams],
    );

    // Dispatch (派遣) labour cost & profit only attach where the dimension maps
    // cleanly to a session (staff, business_line). Sessions don't carry
    // client/site, so those dimensions leave labour null. Admin-only.
    if (admin && (dimension === "staff" || dimension === "business_line")) {
      const keyExpr = dimension === "staff" ? "rs.staff_id" : "rs.business_line_id";
      const labor = await this.laborByKey(user, filters, keyExpr);
      for (const row of rows) {
        const cost = labor.get(row.dimension_id ?? "") ?? 0;
        row.dispatch_labor_cost = cost;
        row.profit_excl = (row.revenue_excl ?? 0) - cost;
      }
    }

    return rows;
  }
}
