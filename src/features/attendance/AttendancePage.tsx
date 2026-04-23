"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  attendanceLogs,
  getStaffName,
  getSiteName,
  getTodayAttendanceStats,
  MOCK_TODAY,
} from "@/lib/mockData";
import { MapPin, Clock, Users, AlertTriangle } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { isEmployeeUser, resolveStaffProfile } from "@/lib/employeeScope";

export default function AttendancePage() {
  const { user } = useAuth();
  const staff = resolveStaffProfile(user);
  const employee = isEmployeeUser(user) && staff;
  const staffId = employee ? staff.id : undefined;
  const missingProfile = isEmployeeUser(user) && !staff;

  const stats = getTodayAttendanceStats(staffId);
  const todayLogs = employee
    ? attendanceLogs.filter((a) => a.date === MOCK_TODAY && a.staffId === staffId)
    : attendanceLogs.filter((a) => a.date === MOCK_TODAY);

  if (missingProfile) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        従業員プロフィールがアカウントに連携されていません。管理者に連絡してください。
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">勤怠管理</h1>
        <p className="text-sm text-muted-foreground -mt-0.5">
          {employee ? "あなたの本日の打刻" : "GPS打刻・勤怠状況の確認"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-4 md:gap-3">
        <Card className="animate-fade-in">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="rounded-lg bg-success/10 p-2">
              <Users className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xl font-bold sm:text-2xl">{stats.present}</p>
              <p className="text-[10px] text-muted-foreground sm:text-xs">出勤済</p>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold sm:text-2xl">{stats.working}</p>
              <p className="text-[10px] text-muted-foreground sm:text-xs">勤務中</p>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="rounded-lg bg-warning/10 p-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xl font-bold sm:text-2xl">{stats.late}</p>
              <p className="text-[10px] text-muted-foreground sm:text-xs">遅刻</p>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="rounded-lg bg-destructive/10 p-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-xl font-bold sm:text-2xl">{stats.absent}</p>
              <p className="text-[10px] text-muted-foreground sm:text-xs">未出勤</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="animate-fade-in">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">本日の打刻記録</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[520px] text-xs sm:min-w-0 sm:text-sm">
              <thead>
                <tr>
                  {!employee && <th>スタッフ</th>}
                  <th>現場</th>
                  <th>出勤</th>
                  <th>退勤</th>
                  <th>状態</th>
                  <th>GPS</th>
                </tr>
              </thead>
              <tbody>
                {todayLogs.length === 0 && (
                  <tr>
                    <td colSpan={employee ? 5 : 6} className="py-8 text-center text-muted-foreground">
                      本日の記録はありません
                    </td>
                  </tr>
                )}
                {todayLogs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-muted/30">
                    {!employee && (
                      <td className="text-sm font-medium">{getStaffName(log.staffId)}</td>
                    )}
                    <td className="text-sm">{getSiteName(log.siteId)}</td>
                    <td className="text-sm">
                      {log.punchIn !== "00:00" ? log.punchIn : "—"}
                    </td>
                    <td className="text-sm">{log.punchOut ?? "—"}</td>
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
                    <td>
                      {log.lat !== 0 ? (
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary">
                          <MapPin className="h-3 w-3" />
                          確認
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
