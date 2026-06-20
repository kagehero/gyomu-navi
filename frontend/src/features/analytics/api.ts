import { useQuery } from "@tanstack/react-query";
import { apiDownload, apiGet } from "@/lib/api";

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
  worked_hours?: number | null;
  count_per_hour?: number | null;
  revenue_excl_per_hour?: number | null;
  dispatch_labor_cost?: number | null;
  profit_excl?: number | null;
};

export type SortKey =
  | "total_count"
  | "revenue_excl"
  | "report_count"
  | "count_per_hour"
  | "revenue_excl_per_hour"
  | "dimension_name";

export type AnalyticsRangeParams = {
  date?: string;
  from?: string;
  to?: string;
  staff_id?: string;
  client_id?: string;
  site_id?: string;
  sort_by?: SortKey;
  sort_dir?: "asc" | "desc";
};

export type DashboardData = {
  date: string;
  range: { from: string; to: string };
  today: AggregationRow;
  weekly_trend: AggregationRow[];
  by_client: AggregationRow[];
  attendance: {
    work_date: string;
    total: number;
    present: number;
    working: number;
    late: number;
    absent: number;
  };
};

function buildQs(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function useDashboardAnalytics(date?: string) {
  return useQuery({
    queryKey: ["analytics", "dashboard", date ?? "today"],
    queryFn: () =>
      apiGet<DashboardData>(`/api/analytics/dashboard${buildQs({ date })}`),
  });
}

function useAnalyticsQuery<T>(
  key: string,
  path: string,
  params: AnalyticsRangeParams,
  enabled = true,
) {
  return useQuery({
    queryKey: ["analytics", key, params],
    queryFn: () =>
      apiGet<{ items: AggregationRow[]; range: { from: string; to: string } }>(
        `${path}${buildQs(params)}`,
      ),
    enabled,
  });
}

export function useDailyAnalytics(params: AnalyticsRangeParams = {}, enabled = true) {
  return useAnalyticsQuery("daily", "/api/analytics/daily", params, enabled);
}

export function useWeeklyAnalytics(params: AnalyticsRangeParams = {}, enabled = true) {
  return useAnalyticsQuery("weekly", "/api/analytics/weekly", params, enabled);
}

export function useMonthlyAnalytics(params: AnalyticsRangeParams = {}, enabled = true) {
  return useAnalyticsQuery("monthly", "/api/analytics/monthly", params, enabled);
}

export function useClientAnalytics(params: AnalyticsRangeParams = {}, enabled = true) {
  return useAnalyticsQuery("by-client", "/api/analytics/by-client", params, enabled);
}

export function useStaffAnalytics(params: AnalyticsRangeParams = {}, enabled = true) {
  return useAnalyticsQuery("by-staff", "/api/analytics/by-staff", params, enabled);
}

export function useSiteAnalytics(params: AnalyticsRangeParams = {}, enabled = true) {
  return useAnalyticsQuery("by-site", "/api/analytics/by-site", params, enabled);
}

export function useBusinessLineAnalytics(params: AnalyticsRangeParams = {}, enabled = true) {
  return useAnalyticsQuery(
    "by-business-line",
    "/api/analytics/by-business-line",
    params,
    enabled,
  );
}

export type CsvExportParams = AnalyticsRangeParams & {
  group_by?:
    | "detail"
    | "daily"
    | "weekly"
    | "monthly"
    | "client"
    | "staff"
    | "site"
    | "business_line";
};

export async function downloadReportsCsv(params: CsvExportParams): Promise<void> {
  await apiDownload(
    `/api/analytics/export${buildQs({
      ...params,
      group_by: params.group_by ?? "detail",
    })}`,
    "reports.csv",
  );
}
