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
import { useAuth } from "@/features/auth/useAuth";
import { useMySites } from "@/features/attendance/api";
import {
  useReports,
  useMyBusinessTypes,
  useCreateReport,
  uploadReportImage,
} from "@/features/reports/api";
import { useClients, useStaffs } from "@/features/master/api";
import { Plus, Search, Download, Filter, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

function todayJST(): string {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 10);
}

const formSchema = z.object({
  site_id: z.string().min(1, "現場を選んでください"),
  business_type_id: z.string().min(1, "業務内容を選んでください"),
  count: z.coerce.number().int().min(0),
  memo: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

function NewReportDialog() {
  const sitesQ = useMySites();
  const btQ = useMyBusinessTypes();
  const createReport = useCreateReport();
  const [open, setOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { site_id: "", business_type_id: "", count: 0, memo: "" },
  });

  const wSite = form.watch("site_id");

  const sites = sitesQ.data?.items ?? [];
  const allBts = btQ.data?.items ?? [];
  const siteClientId = sites.find((s) => s.id === wSite)?.client_id ?? null;
  const btsForSite = useMemo(
    () => (siteClientId ? allBts.filter((b) => b.client_id === siteClientId) : []),
    [allBts, siteClientId],
  );

  // Auto-pick first site once the list loads.
  useEffect(() => {
    if (!form.getValues("site_id") && sites[0]) {
      form.setValue("site_id", sites[0].id);
    }
  }, [sites, form]);

  // Reset business_type_id whenever the site (and thus client) changes.
  useEffect(() => {
    const current = form.getValues("business_type_id");
    if (current && !btsForSite.some((b) => b.id === current)) {
      form.setValue("business_type_id", btsForSite[0]?.id ?? "");
    } else if (!current && btsForSite[0]) {
      form.setValue("business_type_id", btsForSite[0].id);
    }
  }, [btsForSite, form]);

  const onSubmit = async (v: FormValues) => {
    let imageUrl: string | null = null;
    if (imageFile) {
      setUploading(true);
      try {
        imageUrl = await uploadReportImage(imageFile);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
        // If Blob is unconfigured, fall back to submitting without an image.
        if (msg.includes("blob_unconfigured") || msg.includes("未設定")) {
          toast.warning("画像アップロードは未設定です。テキストのみ登録します。");
        } else {
          toast.error(msg);
          setUploading(false);
          return;
        }
      } finally {
        setUploading(false);
      }
    }
    try {
      await createReport.mutateAsync({
        site_id: v.site_id,
        business_type_id: v.business_type_id,
        count: v.count,
        memo: v.memo ?? null,
        image_url: imageUrl,
      });
      toast.success("日報を登録しました");
      form.reset({ site_id: v.site_id, business_type_id: v.business_type_id, count: 0, memo: "" });
      setImageFile(null);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登録に失敗しました");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">現場</Label>
              <Select
                value={form.watch("site_id")}
                onValueChange={(v) => form.setValue("site_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
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
                value={form.watch("business_type_id")}
                onValueChange={(v) => form.setValue("business_type_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {btsForSite.map((b) => (
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
            <Label className="text-xs">画像 (任意)</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="h-10"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            {imageFile && (
              <p className="text-[10px] text-muted-foreground">
                <ImageIcon className="mr-1 inline h-3 w-3" />
                {imageFile.name} ({Math.round(imageFile.size / 1024)} KB)
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">備考</Label>
            <Textarea rows={3} placeholder="備考を入力…" {...form.register("memo")} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={createReport.isPending || uploading}>
              {(createReport.isPending || uploading) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              登録
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";
  const isAdmin = user?.role === "admin";

  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [searchDate, setSearchDate] = useState<string>(todayJST());

  // For employees we only date-filter (their list is already scoped server-side).
  // For admin/manager we expose client + staff filters too.
  const listParams = useMemo(() => {
    return {
      to: searchDate || undefined,
      staff_id: !isEmployee && filterStaff !== "all" ? filterStaff : undefined,
      client_id: !isEmployee && filterClient !== "all" ? filterClient : undefined,
    };
  }, [searchDate, filterStaff, filterClient, isEmployee]);

  const reportsQ = useReports(listParams);
  // Filter dropdowns rely on admin-only master endpoints, so only admin gets them.
  // Manager still sees the list (server-side scope), they just can't slice further.
  const clientsQ = useClients({ enabled: isAdmin });
  const staffsQ = useStaffs({ enabled: isAdmin });
  const clients = clientsQ.data?.items ?? [];
  const staffs = staffsQ.data?.items ?? [];

  const items = reportsQ.data?.items ?? [];

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">業務報告</h1>
          <p className="text-sm text-muted-foreground">
            {isEmployee ? "日報の登録と自分の履歴" : "業務報告の一覧・検索"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" className="h-9">
              <Download className="mr-1 h-3.5 w-3.5" />
              CSV出力
            </Button>
          )}
          {isEmployee && <NewReportDialog />}
        </div>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">表示条件</span>
          </div>
          {isEmployee || !isAdmin ? (
            <div className="space-y-1.5">
              <Label className="text-xs">までの日付 (この日以前の日報を表示)</Label>
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
                <Label className="text-xs text-muted-foreground">日付 (この日以前)</Label>
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
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            {isEmployee ? "あなたの日報" : "検索結果"} ({items.length}件)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px] text-xs sm:min-w-0 sm:text-sm">
              <thead>
                <tr>
                  <th>報告日時</th>
                  {!isEmployee && <th>スタッフ</th>}
                  <th>顧客</th>
                  <th>現場</th>
                  <th>業務内容</th>
                  <th className="text-right">件数</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                {reportsQ.isLoading && (
                  <tr>
                    <td colSpan={isEmployee ? 6 : 7} className="py-6 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                )}
                {reportsQ.isError && (
                  <tr>
                    <td colSpan={isEmployee ? 6 : 7} className="py-6 text-center text-sm text-destructive">
                      {reportsQ.error instanceof Error
                        ? reportsQ.error.message
                        : "読み込みに失敗しました"}
                    </td>
                  </tr>
                )}
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      {new Date(r.reported_at).toLocaleString("ja-JP", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Tokyo",
                      })}
                    </td>
                    {!isEmployee && <td className="font-medium">{r.staff_name}</td>}
                    <td>{r.client_name}</td>
                    <td className="text-muted-foreground">{r.site_name}</td>
                    <td>
                      <span className="status-badge bg-primary/10 text-primary">
                        {r.business_type_name}
                      </span>
                    </td>
                    <td className="text-right font-medium">{r.count}</td>
                    <td className="max-w-[140px] truncate text-muted-foreground sm:max-w-[200px]">
                      {r.memo || "—"}
                    </td>
                  </tr>
                ))}
                {!reportsQ.isLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={isEmployee ? 6 : 7} className="py-8 text-center text-muted-foreground">
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
