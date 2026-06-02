"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Plus, Loader2, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { todayJST } from "@/lib/dates";
import { apiGet, apiPatch } from "@/lib/api";
import {
  uploadReportImage,
  useCreateReportSession,
  useMyBusinessLines,
  useReportSession,
  useUpdateReportSession,
  type CustomerBlock,
  type ReportSession,
} from "@/features/reports/api";
import { formatBytes } from "@/lib/reports/image-compression";
import {
  CustomerBlockEditor,
  newBlock,
  sessionToBlocks,
  type CustomerBlockState,
} from "./CustomerBlockEditor";

const EMPTY_BUSINESS_LINES: { id: string; name: string; client_count?: number }[] = [];

const DRAFT_STORAGE_KEY = "gyomu_navi.report_draft_v1";

type Draft = {
  work_date: string;
  business_line_id: string;
  memo: string;
  blocks: CustomerBlockState[];
  saved_at: number;
};

function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    if (!parsed.blocks || !Array.isArray(parsed.blocks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(draft: Draft): void {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage disabled — non-fatal */
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}

function isEmptyBlocks(blocks: CustomerBlockState[]): boolean {
  if (blocks.length === 0) return true;
  if (blocks.length > 1) return false;
  const b = blocks[0]!;
  if (b.client_id || b.site_id) return false;
  return b.lines.every((l) => !l.business_type_id && !l.count);
}

type ReportSessionFormProps = {
  sessionId?: string | null;
  onDone?: () => void;
  onCancel?: () => void;
};

export function ReportSessionForm({ sessionId = null, onDone, onCancel }: ReportSessionFormProps) {
  const isEdit = !!sessionId;
  const blQ = useMyBusinessLines();
  const sessionQ = useReportSession(sessionId);
  const createSession = useCreateReportSession();
  const updateSession = useUpdateReportSession(sessionId ?? "");

  const [workDate, setWorkDate] = useState(todayJST());
  const [businessLineId, setBusinessLineId] = useState("");
  const [memo, setMemo] = useState("");
  const [blocks, setBlocks] = useState<CustomerBlockState[]>([newBlock()]);
  const [loaded, setLoaded] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [draftBanner, setDraftBanner] = useState<Draft | null>(null);

  const businessLines = blQ.data?.items ?? EMPTY_BUSINESS_LINES;

  // On mount (create mode only), offer to restore a sessionStorage draft.
  useEffect(() => {
    if (isEdit) return;
    const d = loadDraft();
    if (d && !isEmptyBlocks(d.blocks)) {
      setDraftBanner(d);
    }
  }, [isEdit]);

  const restoreDraft = () => {
    if (!draftBanner) return;
    setWorkDate(draftBanner.work_date);
    setBusinessLineId(draftBanner.business_line_id);
    setMemo(draftBanner.memo);
    setBlocks(draftBanner.blocks);
    setDraftBanner(null);
  };

  const discardDraft = () => {
    clearDraft();
    setDraftBanner(null);
  };

  // Auto-save the in-progress draft (create mode only). Debounced ~600ms via
  // a setTimeout cleanup. Skipped while the user is still deciding whether
  // to restore an existing draft.
  useEffect(() => {
    if (isEdit || draftBanner) return;
    if (isEmptyBlocks(blocks) && !memo && !businessLineId) {
      clearDraft();
      return;
    }
    const t = setTimeout(() => {
      saveDraft({
        work_date: workDate,
        business_line_id: businessLineId,
        memo,
        blocks,
        saved_at: Date.now(),
      });
    }, 600);
    return () => clearTimeout(t);
  }, [isEdit, draftBanner, workDate, businessLineId, memo, blocks]);

  useEffect(() => {
    if (!isEdit && !businessLineId && businessLines.length) {
      const withClients = businessLines.find((bl) => (bl.client_count ?? 0) > 0);
      setBusinessLineId((withClients ?? businessLines[0]!).id);
    }
  }, [businessLines, businessLineId, isEdit]);

  useEffect(() => {
    if (!isEdit || !sessionQ.data?.item || loaded) return;
    const s = sessionQ.data.item;
    setWorkDate(s.work_date);
    setBusinessLineId(s.business_line_id);
    setMemo(s.memo ?? "");
    setBlocks(sessionToBlocks(s));
    setLoaded(true);
  }, [isEdit, sessionQ.data?.item, loaded]);

  // Reset only when switching away from edit mode (sessionId cleared).
  useEffect(() => {
    if (sessionId) return;
    setLoaded(false);
    setWorkDate(todayJST());
    setMemo("");
    setBlocks([newBlock()]);
    setBusinessLineId("");
    setImageFile(null);
    setImagePreview(null);
  }, [sessionId]);

  // Manage object URL lifecycle for the preview.
  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("20MB を超える画像はアップロードできません");
      return;
    }
    setImageFile(f);
  };

  const clearImage = () => setImageFile(null);

  const addCustomerBlock = () => setBlocks((b) => [...b, newBlock()]);
  const updateBlock = useCallback((idx: number, block: CustomerBlockState) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? block : b)));
  }, []);
  const removeBlock = (idx: number) => {
    setBlocks((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const payload: CustomerBlock[] = useMemo(() => {
    return blocks
      .filter((b) => b.client_id)
      .map((b) => ({
        client_id: b.client_id,
        site_id: b.site_id || null,
        entries: b.lines
          .filter((l) => l.business_type_id && l.count > 0)
          .map(({ business_type_id, count, vehicle_id, line_memo }) => ({
            business_type_id,
            count,
            vehicle_id: vehicle_id || null,
            line_memo: line_memo && Object.keys(line_memo).length ? line_memo : null,
          })),
      }))
      .filter((b) => b.entries.length > 0);
  }, [blocks]);

  const attachImageToSession = async (sessionDetailId: string): Promise<void> => {
    if (!imageFile) return;
    setImageUploading(true);
    try {
      const uploaded = await uploadReportImage(imageFile);
      // Look up the just-created session to find the first entry's report id.
      const detail = await apiGet<{ item: ReportSession }>(
        `/api/reports/sessions/${sessionDetailId}`,
      );
      const firstEntry = detail.item.entries[0];
      if (!firstEntry) {
        toast.warning("報告は登録されましたが、画像を紐付けるエントリが見つかりませんでした");
        return;
      }
      await apiPatch(`/api/reports/${firstEntry.id}`, { image_url: uploaded.url });
      const ratio =
        uploaded.originalBytes > 0
          ? Math.round((1 - uploaded.finalBytes / uploaded.originalBytes) * 100)
          : 0;
      toast.success(
        ratio > 0
          ? `画像を添付しました（${formatBytes(uploaded.originalBytes)} → ${formatBytes(uploaded.finalBytes)}、${ratio}%削減）`
          : `画像を添付しました（${formatBytes(uploaded.finalBytes)}）`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "画像のアップロードに失敗しました";
      // Don't fail the whole submit — the report is already saved.
      toast.error(`画像添付に失敗しました: ${msg}`);
    } finally {
      setImageUploading(false);
    }
  };

  const onSubmit = async () => {
    if (!businessLineId) {
      toast.error("部門を選択してください");
      return;
    }
    if (payload.length === 0) {
      toast.error("1件以上の業務を入力してください");
      return;
    }
    const body = {
      work_date: workDate,
      business_line_id: businessLineId,
      memo: memo.trim() || null,
      customer_blocks: payload,
    };
    try {
      let createdSessionId: string | null = null;
      if (isEdit) {
        const res = await updateSession.mutateAsync(body);
        toast.success("報告を更新しました");
        createdSessionId = res.item.id;
      } else {
        const res = await createSession.mutateAsync(body);
        toast.success(`${res.item.entry_count}件の報告を登録しました`);
        createdSessionId = res.item.id;
      }
      if (createdSessionId) {
        await attachImageToSession(createdSessionId);
      }
      if (!isEdit) {
        setMemo("");
        setBlocks([newBlock()]);
        setImageFile(null);
        clearDraft();
      }
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登録に失敗しました");
    }
  };

  const pending = createSession.isPending || updateSession.isPending || imageUploading;

  if (blQ.isLoading || (isEdit && sessionQ.isLoading)) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isEdit && sessionQ.isError) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-destructive">
          {sessionQ.error instanceof Error ? sessionQ.error.message : "読み込みに失敗しました"}
        </CardContent>
      </Card>
    );
  }

  if (businessLines.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          担当部門が設定されていません。管理者に連絡してください。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {draftBanner && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs sm:text-sm">
              前回の下書きが残っています（
              {new Date(draftBanner.saved_at).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
              ）。復元しますか？
            </p>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={discardDraft}>
                破棄
              </Button>
              <Button size="sm" onClick={restoreDraft}>
                復元
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{isEdit ? "報告を編集" : "報告日・部門"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">日付</Label>
            <Input
              type="date"
              className="h-10"
              value={workDate}
              max={todayJST()}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">部門</Label>
            <Select
              value={businessLineId || undefined}
              onValueChange={(id) => {
                setBusinessLineId(id);
                setBlocks([newBlock()]);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {businessLines.map((bl) => (
                  <SelectItem key={bl.id} value={bl.id}>
                    {bl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {blocks.map((block, idx) => (
        <CustomerBlockEditor
          key={block.key}
          block={block}
          businessLineId={businessLineId}
          onChange={(b) => updateBlock(idx, b)}
          onRemove={() => removeBlock(idx)}
          canRemove={blocks.length > 1}
        />
      ))}

      <Button type="button" variant="outline" className="w-full" onClick={addCustomerBlock}>
        <Plus className="mr-1 h-4 w-4" />
        別の顧客を追加
      </Button>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">日次連絡メモ（任意）</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            placeholder="現場での連絡事項、お客様からの質問への回答など…"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ImageIcon className="h-4 w-4 text-primary" />
            報告画像（任意）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {imagePreview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL preview; next/image can't optimise it */}
              <img
                src={imagePreview}
                alt="選択した画像のプレビュー"
                className="max-h-60 w-auto rounded-md border object-contain"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                onClick={clearImage}
                aria-label="画像を削除"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Label
              htmlFor="report-image-input"
              className="flex h-24 cursor-pointer items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/40"
            >
              タップして画像を選択（JPEG / PNG / HEIC / WebP）
            </Label>
          )}
          <Input
            id="report-image-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            capture="environment"
            className="hidden"
            onChange={onPickImage}
          />
          {imageFile && (
            <p className="text-[10px] text-muted-foreground">
              {imageFile.name} — {formatBytes(imageFile.size)}（送信時に自動圧縮されます）
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={onCancel}>
            キャンセル
          </Button>
        )}
        <Button
          type="button"
          className="h-11 flex-1"
          disabled={pending}
          onClick={onSubmit}
        >
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "報告を更新" : "報告を登録"}
        </Button>
      </div>
    </div>
  );
}
