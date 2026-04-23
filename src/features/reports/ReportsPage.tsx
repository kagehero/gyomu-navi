"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  type BusinessReport,
  businessReports,
  staffs,
  clientCompanies,
  sites,
  businessTypes,
  getSiteName,
  getClientName,
  getBusinessTypeName,
  getStaffName,
  MOCK_TODAY,
} from "@/lib/mockData";
import { useAuth } from "@/features/auth/useAuth";
import { isAdmin, isEmployeeUser, resolveStaffProfile } from "@/lib/employeeScope";
import { Plus, Search, Download, Filter } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "gyomu_local_reports_v1";

function loadLocalReports(): BusinessReport[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BusinessReport[];
  } catch {
    return [];
  }
}

function saveLocalReports(reports: BusinessReport[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

const formSchema = z.object({
  siteId: z.string().min(1, "現場を選んでください"),
  businessTypeId: z.string().min(1, "業務内容を選んでください"),
  count: z.coerce.number().int().min(0),
  memo: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ReportsPage() {
  const { user } = useAuth();
  const staff = resolveStaffProfile(user);
  const employee = isEmployeeUser(user) && staff;
  const missingProfile = isEmployeeUser(user) && !staff;

  const [localReports, setLocalReports] = useState<BusinessReport[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [searchDate, setSearchDate] = useState<string>(MOCK_TODAY);

  useEffect(() => {
    setLocalReports(loadLocalReports());
  }, []);

  const allReports = useMemo(
    () => [...businessReports, ...localReports],
    [localReports],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { siteId: "", businessTypeId: "", count: 0, memo: "" },
  });

  const wSite = form.watch("siteId");

  const sitesForForm = useMemo(() => {
    if (employee && staff) {
      return sites.filter((s) => staff.siteIds.includes(s.id));
    }
    return sites;
  }, [employee, staff]);

  const businessTypesForForm = useMemo(() => {
    const cid = sites.find((s) => s.id === wSite)?.clientId;
    if (!cid) return businessTypes;
    return businessTypes.filter((b) => b.clientId === cid);
  }, [wSite]);

  useEffect(() => {
    if (employee && staff && !showForm) {
      const first = sites.find((s) => staff.siteIds.includes(s.id));
      if (first) {
        form.reset({
          siteId: first.id,
          businessTypeId: businessTypes.find((b) => b.clientId === first.clientId)?.id ?? "",
          count: 0,
          memo: "",
        });
      }
    }
  }, [employee, staff, form, showForm]);

  const filtered = useMemo(() => {
    let list = allReports;
    if (employee && staff) {
      list = list.filter((r) => r.staffId === staff.id);
      if (searchDate) {
        list = list.filter((r) => r.reportedAt.slice(0, 10) <= searchDate);
      }
    } else {
      list = list.filter((r) => {
        const mC = filterClient === "all" || r.clientId === filterClient;
        const mS = filterStaff === "all" || r.staffId === filterStaff;
        const mD = !searchDate || r.reportedAt.slice(0, 10) <= searchDate;
        return mC && mS && mD;
      });
    }
    return [...list].sort(
      (a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
    );
  }, [allReports, employee, staff, filterClient, filterStaff, searchDate]);

  const onSubmitReport = (v: FormValues) => {
    if (!employee || !staff) return;
    const site = sites.find((s) => s.id === v.siteId);
    if (!site) {
      toast.error("現場を選択してください");
      return;
    }
    const newR: BusinessReport = {
      id: `local-${Date.now()}`,
      staffId: staff.id,
      siteId: v.siteId,
      clientId: site.clientId,
      businessTypeId: v.businessTypeId,
      count: v.count,
      reportedAt: new Date().toISOString().slice(0, 19),
      memo: v.memo,
    };
    const next = [...localReports, newR];
    setLocalReports(next);
    saveLocalReports(next);
    toast.success("日報を登録しました");
    setShowForm(false);
  };

  if (missingProfile) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        従業員プロフィールがアカウントに連携されていません。管理者に連絡してください。
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">業務報告</h1>
          <p className="text-sm text-muted-foreground">
            {employee ? "日報の登録と自分の履歴" : "業務報告の一覧・検索・新規登録"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin(user) && (
            <Button variant="outline" size="sm" className="h-9">
              <Download className="mr-1 h-3.5 w-3.5" />
              CSV出力
            </Button>
          )}
          {employee && (
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-10 min-w-[7rem] sm:h-9">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  新規日報
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>日報を登録</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={form.handleSubmit(onSubmitReport)}
                  className="space-y-4 py-2"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">現場</Label>
                      <Select
                        value={form.watch("siteId")}
                        onValueChange={(v) => {
                          form.setValue("siteId", v);
                          const si = sites.find((s) => s.id === v);
                          if (si) {
                            const bt = businessTypes.find((b) => b.clientId === si.clientId);
                            if (bt) form.setValue("businessTypeId", bt.id);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {sitesForForm.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">業務内容</Label>
                      <Select
                        value={form.watch("businessTypeId")}
                        onValueChange={(v) => form.setValue("businessTypeId", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {businessTypesForForm.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">件数</Label>
                    <Input type="number" className="h-10" {...form.register("count")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">備考</Label>
                    <Textarea rows={3} placeholder="備考を入力…" {...form.register("memo")} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    日付は送信時点の日時で記録されます（本日以前の履歴と一覧表示されます）
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      キャンセル
                    </Button>
                    <Button type="submit">登録</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {!employee && (
            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  新規報告
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>業務報告を作成</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">管理者用の仮画面です。現場従業員は「従業員」アカウントで日報登録を行ってください。</p>
                <Button onClick={() => setShowForm(false)}>閉じる</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">表示条件</span>
          </div>
          {employee ? (
            <div className="space-y-1.5">
              <Label className="text-xs">までの日付（今日までの日報を表示）</Label>
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
                <Label className="text-xs text-muted-foreground">日付（この日以前）</Label>
                <Input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">顧客企業</Label>
                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {clientCompanies.map((c) => (
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
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            {employee ? "あなたの日報" : "検索結果"}（{filtered.length}件）
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px] text-xs sm:min-w-0 sm:text-sm">
              <thead>
                <tr>
                  <th>報告日時</th>
                  {!employee && <th>スタッフ</th>}
                  <th>顧客</th>
                  <th>現場</th>
                  <th>業務内容</th>
                  <th className="text-right">件数</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      {new Date(r.reportedAt).toLocaleString("ja-JP", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    {!employee && (
                      <td className="font-medium">{getStaffName(r.staffId)}</td>
                    )}
                    <td>{getClientName(r.clientId)}</td>
                    <td className="text-muted-foreground">{getSiteName(r.siteId)}</td>
                    <td>
                      <span className="status-badge bg-primary/10 text-primary">
                        {getBusinessTypeName(r.businessTypeId)}
                      </span>
                    </td>
                    <td className="text-right font-medium">{r.count}</td>
                    <td className="max-w-[140px] truncate text-muted-foreground sm:max-w-[200px]">
                      {r.memo || "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={employee ? 6 : 7} className="py-8 text-center text-muted-foreground">
                      該当する報告がありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
