"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2, PieChart as PieChartIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/features/auth/useAuth";
import {
  useBusinessLineAnalytics,
  useClientAnalytics,
  useDailyAnalytics,
  useMonthlyAnalytics,
  useSiteAnalytics,
  useStaffAnalytics,
  useWeeklyAnalytics,
  type SortKey,
} from "@/features/analytics/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  showPerHour = false,
  showProfit = false,
}: {
  title: string;
  labelHeader: string;
  labelMode: "period" | "dimension";
  isAdmin: boolean;
  showPerHour?: boolean;
  showProfit?: boolean;
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
        showPerHour={showPerHour}
        showProfit={showProfit}
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
  const [sortBy, setSortBy] = useState<SortKey>("total_count");
  const params = useMemo(() => filtersToParams(filters), [filters]);

  // Ranking sort applies to the dimension tabs only. Per-hour keys are
  // meaningful on the staff tab; we still send them and the backend returns
  // NULLs (sorted last) elsewhere.
  const dimParams = useMemo(
    () => ({ ...params, sort_by: sortBy, sort_dir: "desc" as const }),
    [params, sortBy],
  );
  const isDimensionTab = ["client", "staff", "site", "business_line"].includes(tab);

  useEffect(() => {
    if (isEmployee) router.replace("/");
  }, [isEmployee, router]);

  const dailyQ = useDailyAnalytics(params, tab === "daily");
  const weeklyQ = useWeeklyAnalytics(params, tab === "weekly");
  const monthlyQ = useMonthlyAnalytics(params, tab === "monthly");
  const clientQ = useClientAnalytics(dimParams, tab === "client");
  const staffQ = useStaffAnalytics(dimParams, tab === "staff");
  const siteQ = useSiteAnalytics(dimParams, tab === "site");
  const businessLineQ = useBusinessLineAnalytics(dimParams, tab === "business_line");

  if (isEmployee) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            売上・報告集計
          </span>
        }
        description="日次・週次・月次および顧客/従業員/現場別の集計を確認できます"
        actions={<CsvExportMenu params={params} />}
      />

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
          <TabsTrigger value="business_line" className="text-xs sm:text-sm">
            部門別
          </TabsTrigger>
        </TabsList>

        {isDimensionTab && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">並び順（ランキング）</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="h-9 w-56 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total_count">総数量が多い順</SelectItem>
                {isAdmin && (
                  <SelectItem value="revenue_excl">売上(税抜)が高い順</SelectItem>
                )}
                <SelectItem value="report_count">報告件数が多い順</SelectItem>
                {tab === "staff" && (
                  <SelectItem value="count_per_hour">時間当たり台数が多い順</SelectItem>
                )}
                {tab === "staff" && isAdmin && (
                  <SelectItem value="revenue_excl_per_hour">
                    時間当たり売上が高い順
                  </SelectItem>
                )}
                <SelectItem value="dimension_name">名称順</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <TabsContent value="daily" className="mt-4">
          <TabPanel
            title="日次集計"
            labelHeader="作業日"
            labelMode="period"
            isAdmin={isAdmin}
            query={dailyQ}
            showProfit
          />
        </TabsContent>
        <TabsContent value="weekly" className="mt-4">
          <TabPanel
            title="週次集計"
            labelHeader="週（ISO）"
            labelMode="period"
            isAdmin={isAdmin}
            query={weeklyQ}
            showProfit
          />
        </TabsContent>
        <TabsContent value="monthly" className="mt-4">
          <TabPanel
            title="月次集計"
            labelHeader="年月"
            labelMode="period"
            isAdmin={isAdmin}
            query={monthlyQ}
            showProfit
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
            showPerHour
            showProfit
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
        <TabsContent value="business_line" className="mt-4">
          <TabPanel
            title="部門別集計"
            labelHeader="部門"
            labelMode="dimension"
            isAdmin={isAdmin}
            query={businessLineQ}
            showProfit
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
