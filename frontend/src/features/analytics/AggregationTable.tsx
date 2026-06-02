"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { AggregationRow } from "@/features/analytics/api";
import { dimensionLabel, periodLabel } from "@/features/analytics/utils";

type Props = {
  title: string;
  items: AggregationRow[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  isAdmin: boolean;
  labelHeader: string;
  labelMode: "period" | "dimension";
  emptyMessage?: string;
};

export function AggregationTable({
  title,
  items,
  isLoading,
  isError,
  errorMessage,
  isAdmin,
  labelHeader,
  labelMode,
  emptyMessage = "該当データがありません",
}: Props) {
  const totals = items.reduce(
    (acc, r) => ({
      report_count: acc.report_count + r.report_count,
      total_count: acc.total_count + r.total_count,
      revenue_excl: acc.revenue_excl + (r.revenue_excl ?? 0),
      revenue_incl: acc.revenue_incl + (r.revenue_incl ?? 0),
    }),
    { report_count: 0, total_count: 0, revenue_excl: 0, revenue_incl: 0 },
  );

  const colSpan = isAdmin ? 5 : 3;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[480px] text-xs sm:text-sm">
            <thead>
              <tr>
                <th>{labelHeader}</th>
                <th className="text-right">報告件数</th>
                <th className="text-right">総数量</th>
                {isAdmin && (
                  <>
                    <th className="text-right">売上(税抜)</th>
                    <th className="text-right">売上(税込)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={colSpan} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={colSpan} className="py-8 text-center text-destructive">
                    {errorMessage ?? "読み込みに失敗しました"}
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                items.map((row) => (
                  <tr key={`${row.period_key}-${row.dimension_id ?? ""}`}>
                    <td className="font-medium">
                      {labelMode === "period" ? periodLabel(row) : dimensionLabel(row)}
                    </td>
                    <td className="text-right">{row.report_count}</td>
                    <td className="text-right">{row.total_count}</td>
                    {isAdmin && (
                      <>
                        <td className="text-right text-muted-foreground">
                          ¥{Math.round(row.revenue_excl ?? 0).toLocaleString()}
                        </td>
                        <td className="text-right font-medium">
                          ¥{Math.round(row.revenue_incl ?? 0).toLocaleString()}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="py-8 text-center text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && items.length > 0 && (
                <tr className="border-t bg-muted/30 font-medium">
                  <td>合計</td>
                  <td className="text-right">{totals.report_count}</td>
                  <td className="text-right">{totals.total_count}</td>
                  {isAdmin && (
                    <>
                      <td className="text-right">
                        ¥{Math.round(totals.revenue_excl).toLocaleString()}
                      </td>
                      <td className="text-right">
                        ¥{Math.round(totals.revenue_incl).toLocaleString()}
                      </td>
                    </>
                  )}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
