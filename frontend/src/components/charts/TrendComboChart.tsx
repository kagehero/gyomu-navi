"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TICK, CHART_COLORS, TOOLTIP_STYLE } from "./theme";

export type TrendDatum = {
  label: string;
  count: number;
  revenue?: number | null;
};

/**
 * Bar chart for report count + optional line chart for revenue on a right
 * Y-axis. Used by the analytics page (daily/weekly/monthly) and the admin
 * dashboard's weekly summary.
 */
export function TrendComboChart({
  data,
  showRevenue,
  countLabel = "報告件数",
  revenueLabel = "税込売上",
}: {
  data: TrendDatum[];
  showRevenue: boolean;
  countLabel?: string;
  revenueLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis dataKey="label" tick={AXIS_TICK} />
        <YAxis
          yAxisId="count"
          tick={AXIS_TICK}
          allowDecimals={false}
          label={{
            value: "件",
            angle: 0,
            position: "insideTopLeft",
            fontSize: 10,
            fill: CHART_COLORS.axis,
            offset: -4,
          }}
        />
        {showRevenue && (
          <YAxis
            yAxisId="revenue"
            orientation="right"
            tick={AXIS_TICK}
            tickFormatter={(v: number) =>
              v >= 10000 ? `${Math.round(v / 1000)}k` : String(v)
            }
          />
        )}
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: number, name: string) => {
            if (name === revenueLabel) {
              return [`¥${Math.round(value).toLocaleString()}`, name];
            }
            return [`${value}件`, name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          yAxisId="count"
          dataKey="count"
          name={countLabel}
          fill={CHART_COLORS.primary}
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
        {showRevenue && (
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name={revenueLabel}
            stroke={CHART_COLORS.success}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.success }}
            activeDot={{ r: 5 }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
