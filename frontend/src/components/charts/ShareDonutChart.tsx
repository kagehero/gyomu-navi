"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CATEGORY_PALETTE, TOOLTIP_STYLE } from "./theme";

export type ShareDatum = {
  name: string;
  value: number;
};

/**
 * Donut chart for share-of-total visualisations. Caps at `topN` slices and
 * folds the remainder into "その他" so the legend stays readable.
 *
 * `valueFormatter` controls both the slice labels and the tooltip values
 * (e.g. yen-format for revenue, plain count for report counts).
 */
export function ShareDonutChart({
  data,
  topN = 6,
  valueFormatter = (v) => v.toLocaleString(),
  unitSuffix = "",
}: {
  data: ShareDatum[];
  topN?: number;
  valueFormatter?: (v: number) => string;
  unitSuffix?: string;
}) {
  const { slices, total } = useMemo(() => {
    const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    const head = sorted.slice(0, topN);
    const tail = sorted.slice(topN);
    if (tail.length > 0) {
      head.push({
        name: `その他 (${tail.length}件)`,
        value: tail.reduce((s, r) => s + r.value, 0),
      });
    }
    const total = head.reduce((s, r) => s + r.value, 0);
    return { slices: head, total };
  }, [data, topN]);

  if (slices.length === 0) return null;

  return (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[180px_1fr]">
      <div className="relative h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={1}
              stroke="none"
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                `${valueFormatter(value)}${unitSuffix} (${Math.round((value / total) * 100)}%)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted-foreground">合計</span>
          <span className="text-sm font-bold">
            {valueFormatter(total)}
            {unitSuffix}
          </span>
        </div>
      </div>

      <ol className="space-y-1.5 text-xs">
        {slices.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.name} className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }}
              />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {valueFormatter(s.value)}
                {unitSuffix}
              </span>
              <span className="w-9 shrink-0 text-right font-medium">{pct}%</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
