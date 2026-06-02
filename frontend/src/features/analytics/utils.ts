import type { AnalyticsRangeParams } from "@/features/analytics/api";

export type AnalyticsFilterState = {
  from: string;
  to: string;
  staff_id: string;
  client_id: string;
  site_id: string;
};

export function filtersToParams(f: AnalyticsFilterState): AnalyticsRangeParams {
  const base: AnalyticsRangeParams = {};
  if (f.staff_id !== "all") base.staff_id = f.staff_id;
  if (f.client_id !== "all") base.client_id = f.client_id;
  if (f.site_id !== "all") base.site_id = f.site_id;
  if (f.from) base.from = f.from;
  if (f.to) base.to = f.to;
  return base;
}

export function periodLabel(row: {
  period_key: string;
  period_start?: string;
  period_end?: string;
}): string {
  if (row.period_start && row.period_end && row.period_start !== row.period_end) {
    return `${row.period_start} 〜 ${row.period_end}`;
  }
  return row.period_key;
}

export function dimensionLabel(row: {
  dimension_name?: string;
  period_key: string;
}): string {
  return row.dimension_name ?? row.period_key;
}
