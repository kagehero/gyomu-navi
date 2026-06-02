"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  formatReportDateTime,
  reportDisplayTimestamp,
  reportImageSrc,
} from "@/lib/reports/format";
import {
  useDeleteReport,
  usePatchReport,
  useReport,
  type BusinessReport,
} from "@/features/reports/api";
import { useBusinessTypes, useSites } from "@/features/master/api";

/**
 * Row actions on ReportsPage:
 *   - 詳細 — admin + manager (read-only)
 *   - 編集 / 削除 — admin only
 */
export function ReportRowActions({
  row,
  canEdit = true,
}: {
  row: BusinessReport;
  canEdit?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <DetailButton row={row} />
      {canEdit && <EditButton row={row} />}
      {canEdit && <DeleteButton row={row} />}
    </div>
  );
}

/* ───────────────────────── Detail ───────────────────────── */

function DetailButton({ row }: { row: BusinessReport }) {
  const [open, setOpen] = useState(false);
  // Refetch on open so admins always see the latest after another window edits.
  const q = useReport(open ? row.id : null);
  const item = q.data?.item ?? row;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label="詳細を表示"
        onClick={() => setOpen(true)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>業務報告 詳細</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">作業日</dt>
          <dd className="col-span-2">{item.work_date ?? "—"}</dd>

          <dt className="text-muted-foreground">報告日時</dt>
          <dd className="col-span-2">
            {formatReportDateTime(reportDisplayTimestamp(item))}
          </dd>

          <dt className="text-muted-foreground">スタッフ</dt>
          <dd className="col-span-2 font-medium">{item.staff_name}</dd>

          <dt className="text-muted-foreground">部門</dt>
          <dd className="col-span-2">{item.business_line_name ?? "—"}</dd>

          <dt className="text-muted-foreground">顧客</dt>
          <dd className="col-span-2">{item.client_name}</dd>

          <dt className="text-muted-foreground">拠点</dt>
          <dd className="col-span-2">{item.site_name}</dd>

          <dt className="text-muted-foreground">業務内容</dt>
          <dd className="col-span-2">
            <span className="status-badge bg-primary/10 text-primary">
              {item.business_type_name}
            </span>
          </dd>

          <dt className="text-muted-foreground">台数</dt>
          <dd className="col-span-2 font-medium">{item.count}</dd>

          {item.unit_price_incl != null && (
            <>
              <dt className="text-muted-foreground">単価(税込)</dt>
              <dd className="col-span-2">
                ¥{Math.round(item.unit_price_incl).toLocaleString()}
              </dd>
            </>
          )}

          {item.line_amount_incl != null && (
            <>
              <dt className="text-muted-foreground">金額(税込)</dt>
              <dd className="col-span-2 font-medium">
                ¥{Math.round(item.line_amount_incl).toLocaleString()}
              </dd>
            </>
          )}

          <dt className="text-muted-foreground">メモ</dt>
          <dd className="col-span-2 whitespace-pre-wrap">{item.memo || "—"}</dd>

          <dt className="text-muted-foreground">日次メモ</dt>
          <dd className="col-span-2 whitespace-pre-wrap">
            {item.session_memo || "—"}
          </dd>

          {item.image_url && (
            <>
              <dt className="text-muted-foreground">画像</dt>
              <dd className="col-span-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- backend image proxy; next/image can't optimise it */}
                <img
                  src={reportImageSrc(item.id)}
                  alt="業務報告の添付画像"
                  className="max-h-64 w-auto rounded-md border object-contain"
                />
              </dd>
            </>
          )}
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Edit ───────────────────────── */

function EditButton({ row }: { row: BusinessReport }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label="編集"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      {/* Mount the form only while open so its hooks (sites/bt lookups) don't
          run for every row in the table. */}
      {open && <EditForm row={row} onClose={() => setOpen(false)} />}
    </Dialog>
  );
}

function EditForm({
  row,
  onClose,
}: {
  row: BusinessReport;
  onClose: () => void;
}) {
  const [siteId, setSiteId] = useState(row.site_id);
  const [businessTypeId, setBusinessTypeId] = useState(row.business_type_id);
  const [count, setCount] = useState(String(row.count));
  const [memo, setMemo] = useState(row.memo ?? "");

  // Sites / business-types loaded once on open. Both are scoped to the
  // current client (admin edit doesn't allow changing the client — staff/
  // client are derived from the original report row).
  const sitesQ = useSites();
  const btsQ = useBusinessTypes();

  const sitesForClient =
    sitesQ.data?.items.filter((s) => s.client_id === row.client_id) ?? [];
  const btsForClient =
    btsQ.data?.items.filter((b) => b.client_id === row.client_id) ?? [];

  const patch = usePatchReport(row.id);

  const onSave = async () => {
    const n = Number.parseInt(count, 10);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("台数は0以上の整数で入力してください");
      return;
    }
    try {
      await patch.mutateAsync({
        site_id: siteId !== row.site_id ? siteId : undefined,
        business_type_id:
          businessTypeId !== row.business_type_id ? businessTypeId : undefined,
        count: n !== row.count ? n : undefined,
        memo: (memo || null) !== (row.memo ?? null) ? memo || null : undefined,
      });
      toast.success("業務報告を更新しました");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>業務報告 編集</DialogTitle>
        <DialogDescription>
          {row.staff_name} / {row.client_name}（顧客とスタッフは変更できません）
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">拠点</Label>
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sitesForClient.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">業務内容</Label>
          <Select value={businessTypeId} onValueChange={setBusinessTypeId}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {btsForClient.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">台数</Label>
          <Input
            type="number"
            min={0}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">メモ</Label>
          <Textarea
            rows={3}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={patch.isPending}>
          キャンセル
        </Button>
        <Button onClick={onSave} disabled={patch.isPending}>
          {patch.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ───────────────────────── Delete ───────────────────────── */

function DeleteButton({ row }: { row: BusinessReport }) {
  const [open, setOpen] = useState(false);
  const del = useDeleteReport();

  const onConfirm = async () => {
    try {
      await del.mutateAsync(row.id);
      toast.success("業務報告を削除しました");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        aria-label="削除"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>業務報告を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            {row.staff_name} / {row.client_name} / {row.site_name} /{" "}
            {row.business_type_name}（{row.count}台）<br />
            この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={del.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            削除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
