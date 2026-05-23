"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Clock, Users, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import {
  useAttendance,
  useAttendanceStats,
  useAttendanceToday,
  useMySites,
  usePunchIn,
  usePunchOut,
  type AttendanceLog,
} from "@/features/attendance/api";
import { toast } from "sonner";

function statusBadge(status: AttendanceLog["status"]) {
  if (status === "done") return { label: "退勤済", cls: "bg-muted text-muted-foreground" };
  if (status === "working") return { label: "勤務中", cls: "bg-success/10 text-success" };
  return { label: "未出勤", cls: "bg-destructive/10 text-destructive" };
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "読み込みに失敗しました";
}

/** Prompt the browser for a GPS fix; resolves with coords or rejects. */
function getCurrentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("この端末では位置情報を取得できません"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      (e) => reject(new Error(e.message || "位置情報の取得に失敗しました")),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

function EmployeePunchPanel() {
  const todayQ = useAttendanceToday();
  const sitesQ = useMySites();
  const punchIn = usePunchIn();
  const punchOut = usePunchOut();
  const [siteId, setSiteId] = useState<string>("");

  const siteOptions = sitesQ.data?.items ?? [];
  const today = todayQ.data?.item ?? null;

  const handlePunchIn = async () => {
    if (!siteId) {
      toast.error("現場を選択してください");
      return;
    }
    try {
      const coords = await getCurrentPosition();
      await punchIn.mutateAsync({
        site_id: siteId,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      toast.success("出勤を記録しました");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const handlePunchOut = async () => {
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const coords = await getCurrentPosition();
        lat = coords.latitude;
        lng = coords.longitude;
      } catch {
        // GPS optional on punch-out
      }
      await punchOut.mutateAsync({ latitude: lat, longitude: lng });
      toast.success("退勤を記録しました");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (todayQ.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">本日の打刻</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {today ? (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">状態:</span>
              <span className={`status-badge ${statusBadge(today.status).cls}`}>
                {statusBadge(today.status).label}
              </span>
            </div>
            <div className="text-muted-foreground">
              出勤 {formatTime(today.punch_in_at)} / 退勤 {formatTime(today.punch_out_at)}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">本日はまだ出勤打刻がありません。</div>
        )}

        {!today && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">現場を選択</label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="配属現場を選択" />
                </SelectTrigger>
                <SelectContent>
                  {siteOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sitesQ.isError && (
                <p className="text-[10px] text-destructive">
                  現場一覧を取得できません: {errorMessage(sitesQ.error)}
                </p>
              )}
            </div>
            <Button
              className="w-full"
              disabled={!siteId || punchIn.isPending}
              onClick={handlePunchIn}
            >
              {punchIn.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              出勤打刻
            </Button>
          </>
        )}

        {today && today.status === "working" && (
          <Button
            className="w-full"
            variant="secondary"
            disabled={punchOut.isPending}
            onClick={handlePunchOut}
          >
            {punchOut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            退勤打刻
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AdminAttendanceList() {
  const statsQ = useAttendanceStats();
  const listQ = useAttendance({ date: statsQ.data?.work_date });
  const stats = statsQ.data;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-4 md:gap-3">
        <Card className="animate-fade-in">
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="rounded-lg bg-success/10 p-2">
              <Users className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xl font-bold sm:text-2xl">{stats?.present ?? "—"}</p>
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
              <p className="text-xl font-bold sm:text-2xl">{stats?.working ?? "—"}</p>
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
              <p className="text-xl font-bold sm:text-2xl">{stats?.late ?? 0}</p>
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
              <p className="text-xl font-bold sm:text-2xl">{stats?.absent ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground sm:text-xs">未出勤</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="animate-fade-in">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            本日の打刻記録 ({listQ.data?.items.length ?? 0}件)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[520px] text-xs sm:min-w-0 sm:text-sm">
              <thead>
                <tr>
                  <th>スタッフ</th>
                  <th>現場</th>
                  <th>出勤</th>
                  <th>退勤</th>
                  <th>状態</th>
                  <th>GPS</th>
                </tr>
              </thead>
              <tbody>
                {listQ.isLoading && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                )}
                {listQ.isError && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-destructive">
                      {errorMessage(listQ.error)}
                    </td>
                  </tr>
                )}
                {listQ.data?.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      本日の記録はありません
                    </td>
                  </tr>
                )}
                {listQ.data?.items.map((log) => {
                  const sb = statusBadge(log.status);
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-muted/30">
                      <td className="text-sm font-medium">{log.staff_name ?? "—"}</td>
                      <td className="text-sm">{log.site_name ?? "—"}</td>
                      <td className="text-sm">{formatTime(log.punch_in_at)}</td>
                      <td className="text-sm">{formatTime(log.punch_out_at)}</td>
                      <td>
                        <span className={`status-badge ${sb.cls}`}>{sb.label}</span>
                      </td>
                      <td>
                        {log.punch_in_lat !== null ? (
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary">
                            <MapPin className="h-3 w-3" />
                            確認
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">勤怠管理</h1>
        <p className="text-sm text-muted-foreground -mt-0.5">
          {isEmployee ? "本日の打刻" : "GPS打刻・勤怠状況の確認"}
        </p>
      </div>

      {isEmployee ? <EmployeePunchPanel /> : <AdminAttendanceList />}
    </div>
  );
}
