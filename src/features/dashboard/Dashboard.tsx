"use client";

import {
  Users,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getTodayAttendanceStats,
  getTodayReportCount,
  getWeeklyReportData,
  getClientRevenueSummary,
  attendanceLogs,
  getStaffName,
  getSiteName,
  MOCK_TODAY,
} from "@/lib/mockData";
import { useAuth } from "@/features/auth/useAuth";
import { isAdmin, resolveStaffProfile, isEmployeeUser } from "@/lib/employeeScope";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
  const staff = resolveStaffProfile(user);
  const employee = isEmployeeUser(user) && staff;
  const staffId = employee ? staff.id : undefined;

  const stats = getTodayAttendanceStats(staffId);
  const reportCount = getTodayReportCount(staffId);
  const weeklyData = getWeeklyReportData(staffId);
  const clientSummary = getClientRevenueSummary(staffId);
  const todayLogs = employee
    ? attendanceLogs.filter((a) => a.date === MOCK_TODAY && a.staffId === staffId)
    : attendanceLogs.filter((a) => a.date === MOCK_TODAY);

  if (isEmployeeUser(user) && !staff) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        従業員プロフィールがアカウントに連携されていません。管理者に連絡してください。
      </div>
    );
  }

  const showOrgKpi = isAdmin(user) && !employee;
  const totalDisplay = showOrgKpi ? stats.total : Math.max(1, stats.total);
  const attendanceRate = Math.round((stats.present / (totalDisplay || 1)) * 100);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">ダッシュボード</h1>
        <p className="-mt-0.5 text-sm text-muted-foreground">
          {employee
            ? "あなたの本日の業務状況"
            : "本日の業務状況をリアルタイムで確認できます"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <KpiCard
          title={employee ? "本日の出勤" : "出勤状況"}
          value={employee ? (stats.present > 0 ? "出勤済" : "未打刻") : `${stats.present}/${stats.total}`}
          subtitle={
            employee
              ? "当日の打刻"
              : `${attendanceRate}% 出勤率`
          }
          icon={Users}
          variant="success"
        />
        <KpiCard
          title="本日の報告"
          value={reportCount}
          subtitle="件"
          icon={ClipboardCheck}
        />
        <KpiCard
          title={employee ? "状態" : "遅刻・未出勤"}
          value={employee ? stats.late + stats.absent : stats.late + stats.absent}
          subtitle={
            employee
              ? stats.late > 0
                ? "遅刻あり"
                : stats.absent > 0
                  ? "未打刻/未出勤"
                  : "問題なし"
              : `遅刻${stats.late}名 / 未出勤${stats.absent}名`
          }
          icon={AlertTriangle}
          variant={stats.late + stats.absent > 0 ? "warning" : "default"}
        />
        <KpiCard
          title="稼働中"
          value={stats.working}
          subtitle={employee ? "本日" : "名がまだ勤務中"}
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="animate-fade-in lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {employee ? "あなたの報告件数（週間）" : "週間業務報告推移"}
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
                  {todayLogs.length === 0 && (
                    <tr>
                      <td colSpan={showOrgKpi ? 3 : 2} className="text-center text-muted-foreground">
                        本日の記録はありません
                      </td>
                    </tr>
                  )}
                  {todayLogs.map((log) => (
                    <tr key={log.id}>
                      {showOrgKpi && (
                        <td className="font-medium">{getStaffName(log.staffId)}</td>
                      )}
                      <td className="text-muted-foreground">{getSiteName(log.siteId)}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            log.status === "退勤済"
                              ? "bg-muted text-muted-foreground"
                              : log.status === "出勤中"
                                ? "bg-success/10 text-success"
                                : log.status === "遅刻"
                                  ? "bg-warning/10 text-warning"
                                  : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {log.status}
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

      {showOrgKpi && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              顧客別売上サマリー
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[480px]">
                <thead>
                  <tr>
                    <th>顧客企業</th>
                    <th>コード</th>
                    <th className="text-right">報告件数</th>
                    <th className="text-right">総数量</th>
                    <th className="text-right">売上（税抜）</th>
                  </tr>
                </thead>
                <tbody>
                  {clientSummary
                    .filter((c) => c.totalReports > 0)
                    .map((c) => (
                      <tr key={c.code}>
                        <td className="font-medium">{c.clientName}</td>
                        <td className="text-muted-foreground">{c.code}</td>
                        <td className="text-right">{c.totalReports}件</td>
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

      {employee && !showOrgKpi && clientSummary.some((c) => c.totalReports > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">関係顧客の報告</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-2 p-2">
              {clientSummary
                .filter((c) => c.totalReports > 0)
                .map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{c.clientName}</span>
                    <span className="text-muted-foreground">
                      {c.totalReports}件 / ¥{c.revenue.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
