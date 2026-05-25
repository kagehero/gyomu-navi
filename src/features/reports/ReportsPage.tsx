"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/useAuth";
import { useReports } from "@/features/reports/api";
import { ReportSessionForm } from "@/features/reports/ReportSessionForm";
import { ReportSessionHistory } from "@/features/reports/ReportSessionHistory";
import { useClients, useStaffs } from "@/features/master/api";
import { Search, Download, Filter, Loader2 } from "lucide-react";
import { todayJST } from "@/lib/dates";

export default function ReportsPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";
  const isAdmin = user?.role === "admin";

  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [searchDate, setSearchDate] = useState<string>(todayJST());

  const listParams = useMemo(() => {
    return {
      date: searchDate || undefined,
      staff_id: !isEmployee && filterStaff !== "all" ? filterStaff : undefined,
      client_id: !isEmployee && filterClient !== "all" ? filterClient : undefined,
    };
  }, [searchDate, filterStaff, filterClient, isEmployee]);

  const reportsQ = useReports(listParams);
  const clientsQ = useClients({ enabled: isAdmin });
  const staffsQ = useStaffs({ enabled: isAdmin });
  const clients = clientsQ.data?.items ?? [];
  const staffs = staffsQ.data?.items ?? [];
  const items = reportsQ.data?.items ?? [];

  const adminTotal = isAdmin
    ? items.reduce((sum, r) => sum + (r.line_amount_incl ?? 0), 0)
    : 0;

  const colSpan = isEmployee ? 7 : isAdmin ? 11 : 9;

  const listSection = (
    <>
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">表示条件</span>
          </div>
          {isEmployee ? (
            <div className="space-y-1.5">
              <Label className="text-xs">報告日</Label>
              <Input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="h-10 max-w-xs"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">報告日</Label>
                <Input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              {isAdmin && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">顧客</Label>
                    <Select value={filterClient} onValueChange={setFilterClient}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">スタッフ</Label>
                    <Select value={filterStaff} onValueChange={setFilterStaff}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
                        {staffs.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && items.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <span className="text-sm text-muted-foreground">税込売上合計（表示分）</span>
            <span className="text-lg font-bold">
              ¥{adminTotal.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Search className="h-4 w-4 text-primary" />
            {isEmployee ? "報告履歴" : "検索結果"} ({items.length}件)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[800px] text-xs sm:text-sm">
              <thead>
                <tr>
                  <th>報告日</th>
                  {!isEmployee && <th>スタッフ</th>}
                  <th>部門</th>
                  <th>顧客</th>
                  <th>拠点</th>
                  <th>業務内容</th>
                  <th className="text-right">台数</th>
                  {isAdmin && (
                    <>
                      <th className="text-right">単価(税込)</th>
                      <th className="text-right">金額(税込)</th>
                    </>
                  )}
                  <th>日次メモ</th>
                </tr>
              </thead>
              <tbody>
                {reportsQ.isLoading && (
                  <tr>
                    <td colSpan={colSpan} className="py-6 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                )}
                {reportsQ.isError && (
                  <tr>
                    <td colSpan={colSpan} className="py-6 text-center text-sm text-destructive">
                      {reportsQ.error instanceof Error
                        ? reportsQ.error.message
                        : "読み込みに失敗しました"}
                    </td>
                  </tr>
                )}
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      {new Date(r.reported_at).toLocaleDateString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                      })}
                    </td>
                    {!isEmployee && <td className="font-medium">{r.staff_name}</td>}
                    <td className="text-muted-foreground">{r.business_line_name ?? "—"}</td>
                    <td>{r.client_name}</td>
                    <td className="text-muted-foreground">{r.site_name}</td>
                    <td>
                      <span className="status-badge bg-primary/10 text-primary">
                        {r.business_type_name}
                      </span>
                    </td>
                    <td className="text-right font-medium">{r.count}</td>
                    {isAdmin && (
                      <>
                        <td className="text-right text-muted-foreground">
                          {r.unit_price_incl != null
                            ? `¥${Math.round(r.unit_price_incl).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="text-right font-medium">
                          {r.line_amount_incl != null
                            ? `¥${Math.round(r.line_amount_incl).toLocaleString()}`
                            : "—"}
                        </td>
                      </>
                    )}
                    <td className="max-w-[160px] truncate text-muted-foreground">
                      {r.session_memo || "—"}
                    </td>
                  </tr>
                ))}
                {!reportsQ.isLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="py-8 text-center text-muted-foreground">
                      該当する報告がありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">業務報告</h1>
          <p className="text-sm text-muted-foreground">
            {isEmployee
              ? "日付・部門・顧客を選んで業務実績を報告"
              : "業務報告の一覧・売上集計"}
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" className="h-9">
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV出力
          </Button>
        )}
      </div>

      {isEmployee ? (
        <Tabs defaultValue="submit">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="submit">報告入力</TabsTrigger>
            <TabsTrigger value="history">履歴</TabsTrigger>
          </TabsList>
          <TabsContent value="submit" className="mt-4">
            <ReportSessionForm />
          </TabsContent>
          <TabsContent value="history" className="mt-4 space-y-4">
            <ReportSessionHistory searchDate={searchDate} onDateChange={setSearchDate} />
          </TabsContent>
        </Tabs>
      ) : (
        listSection
      )}
    </div>
  );
}
