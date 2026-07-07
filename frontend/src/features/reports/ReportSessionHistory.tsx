"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useDeleteReportSession,
  useReportSessions,
  type ReportSession,
} from "@/features/reports/api";
import { ReportSessionForm } from "@/features/reports/ReportSessionForm";
import { DeleteConfirmDialog } from "@/features/master/DeleteConfirmDialog";

type Props = {
  searchDate: string;
  onDateChange: (date: string) => void;
};

import { formatReportDateTime, reportImageSrc } from "@/lib/reports/format";

export function ReportSessionHistory({ searchDate, onDateChange }: Props) {
  const sessionsQ = useReportSessions({ work_date: searchDate || undefined });
  const deleteM = useDeleteReportSession();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ReportSession | null>(null);

  const items = sessionsQ.data?.items ?? [];

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteM.mutateAsync(deleting.id);
      toast.success("報告を削除しました");
      setDeleting(null);
      if (editingId === deleting.id) setEditingId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  if (editingId) {
    return (
      <ReportSessionForm
        sessionId={editingId}
        onDone={() => setEditingId(null)}
        onCancel={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">報告日</Label>
            <Input
              type="date"
              value={searchDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="h-10 max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">提出一覧 ({items.length}件)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsQ.isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {sessionsQ.isError && (
            <p className="py-4 text-center text-sm text-destructive">
              {sessionsQ.error instanceof Error ? sessionsQ.error.message : "読み込みに失敗しました"}
            </p>
          )}
          {items.map((s) => (
            <div key={s.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {s.business_line_name}
                    {s.report_kind === "individual" && (
                      <Badge variant="outline" className="ml-2 border-amber-400 text-amber-700">
                        個人実績（採算用）
                      </Badge>
                    )}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {formatReportDateTime(s.submitted_at)} 提出
                    </span>
                  </p>
                  {s.memo && (
                    <p className="mt-1 text-xs text-muted-foreground">メモ: {s.memo}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setEditingId(s.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleting(s)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {s.entries.map((e) => (
                  <li key={e.id} className="text-muted-foreground">
                    {e.client_name}
                    {e.site_name ? ` / ${e.site_name}` : ""} — {e.business_type_name} × {e.count}
                    {e.image_url && (
                      <span className="ml-2 inline-block align-middle">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={reportImageSrc(e.id)}
                          alt="添付画像"
                          className="mt-1 max-h-24 rounded border object-contain"
                        />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!sessionsQ.isLoading && items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              この日の提出はありません
            </p>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="この報告提出を削除しますか？"
        description="含まれる業務明細もすべて削除されます。この操作は取り消せません。"
        pending={deleteM.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
