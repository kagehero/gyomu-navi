"use client";

import { useMemo } from "react";
import {
  Users,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/useAuth";
import { useAttendance, useAttendanceStats } from "@/features/attendance/api";
import { useReports } from "@/features/reports/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function todayJST(): string {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
}

function jstDateNDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000 + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
}

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
  trend,
  variant = "default",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: string;
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
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs text-success">
            <ArrowUpRight className="h-3 w-3" />
            <span>{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";

  const today = todayJST();
  const weekStart = jstDateNDaysAgo(6);

  const statsQ = useAttendanceStats(today);
  const todayAttQ = useAttendance({ date: today });
  const todayReportsQ = useReports({ date: today });
  const weekReportsQ = useReports({ from: weekStart, to: today });

  const stats = statsQ.data;
  const reportCount = todayReportsQ.data?.items.length ?? 0;
  const todayLogs = todayAttQ.data?.items ?? [];

  // Weekly bar chart: count reports per JST day for the last 7 days.
  const weeklyData = useMemo(() => {
    const days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = jstDateNDaysAgo(i);
      const label = i === 0 ? "今日" : date.slice(5).replace("-", "/");
      const count = (weekReportsQ.data?.items ?? []).filter((r) => {
        const d = new Date(new Date(r.reported_at).getTime() + 9 * 3600_000)
          .toISOString()
          .slice(0, 10);
        return d === date;
      }).length;
      days.push({ day: label, count });
    }
    return days;
  }, [weekReportsQ.data]);

  // Admin-only: per-client summary aggregating all reports we have access to.
  const clientSummary = useMemo(() => {
    const map = new Map<
      string,
      { name: string; reports: number; totalCount: number }
    >();
    for (const r of weekReportsQ.data?.items ?? []) {
      const cur = map.get(r.client_id) ?? {
        name: r.client_name,
        reports: 0,
        totalCount: 0,
      };
      cur.reports += 1;
      cur.totalCount += r.count;
      map.set(r.client_id, cur);
    }
    return [...map.values()]
      .filter((c) => c.reports > 0)
      .map((c) => ({ ...c, revenue: c.totalCount * 3500 })); // 3500yen/件 (mock pricing)
  }, [weekReportsQ.data]);

  const showOrgKpi = isAdmin;
  const attendanceRate =
    stats && stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">ダッシュボード</h1>
        <p className="-mt-0.5 text-sm text-muted-foreground">
          {isEmployee ? "あなたの本日の業務状況" : "本日の業務状況をリアルタイムで確認できます"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <KpiCard
          title={isEmployee ? "本日の出勤" : "出勤状況"}
          value={
            statsQ.isLoading
              ? "—"
              : isEmployee
                ? (stats?.present ?? 0) > 0
                  ? "出勤済"
                  : "未打刻"
                : `${stats?.present ?? 0}/${stats?.total ?? 0}`
          }
          subtitle={isEmployee ? "当日の打刻" : `${attendanceRate}% 出勤率`}
          icon={Users}
          variant="success"
        />
        <KpiCard
          title="本日の報告"
          value={todayReportsQ.isLoading ? "—" : reportCount}
          subtitle="件"
          icon={ClipboardCheck}
        />
        <KpiCard
          title={isEmployee ? "状態" : "遅刻・未出勤"}
          value={statsQ.isLoading ? "—" : (stats?.late ?? 0) + (stats?.absent ?? 0)}
          subtitle={
            isEmployee
              ? (stats?.absent ?? 0) > 0
                ? "未出勤"
                : "問題なし"
              : `遅刻${stats?.late ?? 0}名 / 未出勤${stats?.absent ?? 0}名`
          }
          icon={AlertTriangle}
          variant={(stats?.late ?? 0) + (stats?.absent ?? 0) > 0 ? "warning" : "default"}
        />
        <KpiCard
          title="稼働中"
          value={statsQ.isLoading ? "—" : (stats?.working ?? 0)}
          subtitle={isEmployee ? "本日" : "名がまだ勤務中"}
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="animate-fade-in lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {isEmployee ? "あなたの報告件数（週間）" : "週間業務報告推移"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] sm:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="day"
                    className="text-xs"
                    tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }}
                  />
                  <YAxis className="text-xs" tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(0, 0%, 100%)",
                      border: "1px solid hsl(214, 20%, 90%)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(215, 70%, 45%)" radius={[4, 4, 0, 0]} name="件数" />
                </BarChart>
              </ResponsiveContainer>
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
              顧客別売上サマリー (過去 7 日)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[480px]">
                <thead>
                  <tr>
                    <th>顧客企業</th>
                    <th className="text-right">報告件数</th>
                    <th className="text-right">総数量</th>
                    <th className="text-right">売上（税抜）</th>
                  </tr>
                </thead>
                <tbody>
                  {clientSummary.map((c) => (
                    <tr key={c.name}>
                      <td className="font-medium">{c.name}</td>
                      <td className="text-right">{c.reports}件</td>
                      <td className="text-right">{c.totalCount}</td>
                      <td className="text-right font-medium">¥{c.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
