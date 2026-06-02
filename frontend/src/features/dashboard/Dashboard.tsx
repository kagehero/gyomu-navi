"use client";

import Link from "next/link";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Users,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { useAttendance } from "@/features/attendance/api";
import { useDashboardAnalytics } from "@/features/analytics/api";
import { todayJST } from "@/lib/dates";
import EmployeeDashboard from "./EmployeeDashboard";
import { OnboardingBanner } from "./OnboardingBanner";

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

const AttendanceGauge = dynamic(
  () => import("@/components/charts/AttendanceGauge").then((m) => m.AttendanceGauge),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[120px] items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

function statusBadgeClass(status: string): string {
  if (status === "done") return "bg-muted text-muted-foreground";
  if (status === "working") return "bg-success/10 text-success";
  return "bg-destructive/10 text-destructive";
}

function statusLabel(status: string): string {
  if (status === "done") return "退勤済";
  if (status === "working") return "勤務中";
  return "未出勤";
}

const KpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "destructive";
}) => {
  const variantStyles = {
    default: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };

  return (
    <Card className="animate-fade-in">
      <CardContent className="p-4 sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold sm:text-xl ${variantStyles[variant]}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="rounded-lg bg-muted p-2">
            <Icon className={`h-4 w-4 ${variantStyles[variant]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  // Employees see a task-first dashboard, not KPI cards.
  if (user?.role === "employee") {
    return <EmployeeDashboard />;
  }
  return <AdminDashboard isAdmin={user?.role === "admin"} canViewAnalytics={user?.role === "admin" || user?.role === "manager"} />;
}

function AdminDashboard({
  isAdmin,
  canViewAnalytics,
}: {
  isAdmin: boolean;
  canViewAnalytics: boolean;
}) {
  const today = todayJST();
  const dashQ = useDashboardAnalytics(today);
  const todayAttQ = useAttendance({ date: today });

  const dash = dashQ.data;
  const stats = dash?.attendance;
  const todayLogs = todayAttQ.data?.items ?? [];

  const weeklyData = useMemo(() => {
    const anchor = dash?.date ?? today;
    return (dash?.weekly_trend ?? []).map((row) => {
      const label =
        row.period_key === anchor ? "今日" : row.period_key.slice(5).replace("-", "/");
      return {
        label,
        count: row.report_count,
        revenue: isAdmin ? row.revenue_incl ?? 0 : null,
      };
    });
  }, [dash, today, isAdmin]);

  const clientSummary = useMemo(() => dash?.by_client ?? [], [dash?.by_client]);
  const clientRevenueMax = useMemo(
    () => clientSummary.reduce((m, c) => Math.max(m, c.revenue_incl ?? 0), 0),
    [clientSummary],
  );

  const showOrgKpi = isAdmin;
  const attendanceRate =
    stats && stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">ダッシュボード</h1>
          <p className="-mt-0.5 text-sm text-muted-foreground">
            本日の業務状況をリアルタイムで確認できます
          </p>
        </div>
        {canViewAnalytics && (
          <Button variant="outline" size="sm" className="h-9 shrink-0" asChild>
            <Link href="/analytics">売上・報告集計へ</Link>
          </Button>
        )}
      </div>

      <OnboardingBanner role={isAdmin ? "admin" : "manager"} />

      <div className="grid gap-2 sm:gap-3 lg:grid-cols-4">
        <Card className="animate-fade-in lg:col-span-1">
          <CardContent className="p-4 sm:p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">本日の出勤率</p>
            {dashQ.isLoading ? (
              <div className="flex h-[120px] items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <AttendanceGauge present={stats?.present ?? 0} total={stats?.total ?? 0} />
            )}
          </CardContent>
        </Card>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:col-span-3">
          <KpiCard
            title="本日の報告"
            value={dashQ.isLoading ? "—" : (dash?.today.report_count ?? 0)}
            subtitle="件"
            icon={ClipboardCheck}
          />
          <KpiCard
            title="遅刻・未出勤"
            value={dashQ.isLoading ? "—" : (stats?.late ?? 0) + (stats?.absent ?? 0)}
            subtitle={`遅刻${stats?.late ?? 0}名 / 未出勤${stats?.absent ?? 0}名`}
            icon={AlertTriangle}
            variant={(stats?.late ?? 0) + (stats?.absent ?? 0) > 0 ? "warning" : "default"}
          />
          <KpiCard
            title="稼働中"
            value={dashQ.isLoading ? "—" : (stats?.working ?? 0)}
            subtitle="名がまだ勤務中"
            icon={Clock}
          />
          <KpiCard
            title="今日の税込売上"
            value={
              dashQ.isLoading
                ? "—"
                : `¥${Math.round(dash?.today.revenue_incl ?? 0).toLocaleString()}`
            }
            subtitle={isAdmin ? "売上集計から" : "—"}
            icon={TrendingUp}
            variant="success"
          />
          <KpiCard
            title="出勤予定数"
            value={dashQ.isLoading ? "—" : stats?.total ?? 0}
            subtitle="名"
            icon={Users}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="animate-fade-in lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {isAdmin ? "週間推移（件数 + 税込売上）" : "週間業務報告推移"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[240px]">
              {dashQ.isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <TrendComboChart data={weeklyData} showRevenue={isAdmin} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">本日の勤怠</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[200px] overflow-auto sm:max-h-[220px]">
              <table className="data-table text-xs">
                <thead>
                  <tr>
                    {showOrgKpi && <th>スタッフ</th>}
                    <th>現場</th>
                    <th>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAttQ.isLoading && (
                    <tr>
                      <td colSpan={showOrgKpi ? 3 : 2} className="text-center text-muted-foreground">
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      </td>
                    </tr>
                  )}
                  {!todayAttQ.isLoading && todayLogs.length === 0 && (
                    <tr>
                      <td colSpan={showOrgKpi ? 3 : 2} className="text-center text-muted-foreground">
                        本日の記録はありません
                      </td>
                    </tr>
                  )}
                  {todayLogs.map((log) => (
                    <tr key={log.id}>
                      {showOrgKpi && (
                        <td className="font-medium">{log.staff_name ?? "—"}</td>
                      )}
                      <td className="text-muted-foreground">{log.site_name ?? "—"}</td>
                      <td>
                        <span className={`status-badge ${statusBadgeClass(log.status)}`}>
                          {statusLabel(log.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {showOrgKpi && clientSummary.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              顧客別売上ランキング (過去 7 日)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {clientSummary.slice(0, 8).map((c, i) => {
              const revenue = c.revenue_incl ?? 0;
              const widthPct =
                clientRevenueMax > 0 ? Math.max(2, Math.round((revenue / clientRevenueMax) * 100)) : 0;
              return (
                <div key={c.dimension_id ?? c.period_key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">{c.dimension_name ?? "—"}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {c.report_count}件 · {c.total_count}台
                    </span>
                    <span className="w-24 shrink-0 text-right font-bold text-success">
                      ¥{Math.round(revenue).toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success/70 transition-[width]"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
