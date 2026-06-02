"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2, PieChart as PieChartIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/useAuth";
import {
  useClientAnalytics,
  useDailyAnalytics,
  useMonthlyAnalytics,
  useSiteAnalytics,
  useStaffAnalytics,
  useWeeklyAnalytics,
} from "@/features/analytics/api";
import { AnalyticsFilters } from "@/features/analytics/AnalyticsFilters";
import { AggregationTable } from "@/features/analytics/AggregationTable";
import { CsvExportMenu } from "@/features/analytics/CsvExportMenu";
import {
  filtersToParams,
  type AnalyticsFilterState,
} from "@/features/analytics/utils";
import { jstDateNDaysAgo, todayJST } from "@/lib/dates";

const TrendComboChart = dynamic(
  () => import("@/components/charts/TrendComboChart").then((m) => m.TrendComboChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

const ShareDonutChart = dynamic(
  () => import("@/components/charts/ShareDonutChart").then((m) => m.ShareDonutChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[180px] items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

function defaultFilters(): AnalyticsFilterState {
  const today = todayJST();
  return {
    from: jstDateNDaysAgo(29),
    to: today,
    staff_id: "all",
    client_id: "all",
    site_id: "all",
  };
}

function TabPanel({
  title,
  labelHeader,
  labelMode,
  isAdmin,
  query,
}: {
  title: string;
  labelHeader: string;
  labelMode: "period" | "dimension";
  isAdmin: boolean;
  query: {
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    data?: { items: import("@/features/analytics/api").AggregationRow[] };
  };
}) {
  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  // Period tabs (daily/weekly/monthly) get the trend combo chart.
  const trendData = useMemo(() => {
    if (labelMode !== "period") return [];
    return items.map((row) => ({
      label: row.period_key.length > 7 ? row.period_key.slice(5) : row.period_key,
      count: row.report_count,
      revenue: isAdmin ? row.revenue_incl ?? 0 : null,
    }));
  }, [items, labelMode, isAdmin]);

  // Dimension tabs (client/staff/site) get share donuts.
  const revenueShare = useMemo(() => {
    if (labelMode !== "dimension" || !isAdmin) return [];
    return items
      .map((row) => ({
        name: row.dimension_name ?? row.period_key,
        value: row.revenue_incl ?? 0,
      }))
      .filter((d) => d.value > 0);
  }, [items, labelMode, isAdmin]);

  const countShare = useMemo(() => {
    if (labelMode !== "dimension") return [];
    return items
      .map((row) => ({
        name: row.dimension_name ?? row.period_key,
        value: row.report_count,
      }))
      .filter((d) => d.value > 0);
  }, [items, labelMode]);

  return (
    <div className="space-y-4">
      {labelMode === "period" && trendData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-primary" />
              {isAdmin ? "推移グラフ（件数 + 税込売上）" : "推移グラフ（報告件数）"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <TrendComboChart data={trendData} showRevenue={isAdmin} />
            </div>
          </CardContent>
        </Card>
      )}

      {labelMode === "dimension" && countShare.length > 0 && (
        <div className={`grid gap-4 ${isAdmin && revenueShare.length > 0 ? "lg:grid-cols-2" : ""}`}>
          {isAdmin && revenueShare.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <PieChartIcon className="h-4 w-4 text-success" />
                  税込売上の構成比
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ShareDonutChart
                  data={revenueShare}
                  valueFormatter={(v) => `¥${Math.round(v).toLocaleString()}`}
                />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <PieChartIcon className="h-4 w-4 text-primary" />
                報告件数の構成比
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ShareDonutChart data={countShare} unitSuffix="件" />
            </CardContent>
          </Card>
        </div>
      )}

      <AggregationTable
        title={title}
        items={items}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={query.error?.message}
        isAdmin={isAdmin}
        labelHeader={labelHeader}
        labelMode={labelMode}
      />
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";

  const [filters, setFilters] = useState(defaultFilters);
  const [tab, setTab] = useState("daily");
  const params = useMemo(() => filtersToParams(filters), [filters]);

  useEffect(() => {
    if (isEmployee) router.replace("/");
  }, [isEmployee, router]);

  const dailyQ = useDailyAnalytics(params, tab === "daily");
  const weeklyQ = useWeeklyAnalytics(params, tab === "weekly");
  const monthlyQ = useMonthlyAnalytics(params, tab === "monthly");
  const clientQ = useClientAnalytics(params, tab === "client");
  const staffQ = useStaffAnalytics(params, tab === "staff");
  const siteQ = useSiteAnalytics(params, tab === "site");

  if (isEmployee) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <BarChart3 className="h-6 w-6 text-primary" />
            売上・報告集計
          </h1>
          <p className="text-sm text-muted-foreground">
            日次・週次・月次および顧客/従業員/現場別の集計を確認できます
          </p>
        </div>
        <CsvExportMenu params={params} />
      </div>

      <AnalyticsFilters filters={filters} onChange={setFilters} isAdmin={isAdmin} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="daily" className="text-xs sm:text-sm">
            日次
          </TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs sm:text-sm">
            週次
          </TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs sm:text-sm">
            月次
          </TabsTrigger>
          <TabsTrigger value="client" className="text-xs sm:text-sm">
            顧客別
          </TabsTrigger>
          <TabsTrigger value="staff" className="text-xs sm:text-sm">
            従業員別
          </TabsTrigger>
          <TabsTrigger value="site" className="text-xs sm:text-sm">
            現場別
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <TabPanel
            title="日次集計"
            labelHeader="作業日"
            labelMode="period"
            isAdmin={isAdmin}
            query={dailyQ}
          />
        </TabsContent>
        <TabsContent value="weekly" className="mt-4">
          <TabPanel
            title="週次集計"
            labelHeader="週（ISO）"
            labelMode="period"
            isAdmin={isAdmin}
            query={weeklyQ}
          />
        </TabsContent>
        <TabsContent value="monthly" className="mt-4">
          <TabPanel
            title="月次集計"
            labelHeader="年月"
            labelMode="period"
            isAdmin={isAdmin}
            query={monthlyQ}
          />
        </TabsContent>
        <TabsContent value="client" className="mt-4">
          <TabPanel
            title="顧客別集計"
            labelHeader="顧客"
            labelMode="dimension"
            isAdmin={isAdmin}
            query={clientQ}
          />
        </TabsContent>
        <TabsContent value="staff" className="mt-4">
          <TabPanel
            title="従業員別集計"
            labelHeader="スタッフ"
            labelMode="dimension"
            isAdmin={isAdmin}
            query={staffQ}
          />
        </TabsContent>
        <TabsContent value="site" className="mt-4">
          <TabPanel
            title="現場別集計"
            labelHeader="拠点"
            labelMode="dimension"
            isAdmin={isAdmin}
            query={siteQ}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
