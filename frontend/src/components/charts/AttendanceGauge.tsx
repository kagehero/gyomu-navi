"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "./theme";

/**
 * Half-circle gauge for attendance rate (0-100%). The center label shows
 * the percentage; sub-label shows the present/total ratio.
 */
export function AttendanceGauge({
  present,
  total,
}: {
  present: number;
  total: number;
}) {
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;
  // Wash out the gauge when there's nobody — gray remainder ring only.
  const arc = total > 0 ? rate : 0;

  const data = [
    { name: "出勤", value: arc },
    { name: "残り", value: 100 - arc },
  ];

  const arcColor =
    rate >= 90
      ? CHART_COLORS.success
      : rate >= 70
        ? CHART_COLORS.primary
        : rate >= 40
          ? CHART_COLORS.warning
          : CHART_COLORS.destructive;

  return (
    <div className="relative h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="85%"
            startAngle={180}
            endAngle={0}
            innerRadius={56}
            outerRadius={80}
            paddingAngle={0}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={arcColor} />
            <Cell fill={CHART_COLORS.grid} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-1 text-center">
        <span className="text-2xl font-bold leading-none" style={{ color: arcColor }}>
          {rate}%
        </span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">
          {present} / {total} 名
        </span>
      </div>
    </div>
  );
}
