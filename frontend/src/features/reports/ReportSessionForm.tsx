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
import { apiGet } from "@/lib/api";
import {
  attachReportImages,
  uploadReportImages,
  useCreateReportSession,
  useMyBusinessLines,
  useReportSession,
  useUpdateReportSession,
  saveReportDraft,
  fetchReportDraft,
  deleteReportDraft,
  MAX_REPORT_IMAGES,
  type CustomerBlock,
  type ReportSession,
  type ReportKind,
} from "@/features/reports/api";
import { formatBytes } from "@/lib/reports/image-compression";
import {
  CustomerBlockEditor,
  newBlock,
  sessionToBlocks,
  type CustomerBlockState,
} from "./CustomerBlockEditor";
import { DispatchLaborEditor } from "./DispatchLaborEditor";

const EMPTY_BUSINESS_LINES: { id: string; name: string; client_count?: number }[] = [];

/**
 * In-progress draft snapshot. Persisted server-side (一時保存) keyed by
 * work_date + business_line_id, so it survives across devices/sessions. The
 * object below is the opaque `payload` the backend stores verbatim.
 */
type Draft = {
  work_date: string;
  business_line_id: string;
  memo: string;
  blocks: CustomerBlockState[];
  report_kind: ReportKind;
  saved_at: number;
};

/** Narrow an opaque server payload back into a Draft, or null if malformed. */
function toDraft(payload: Record<string, unknown> | null): Draft | null {
  if (!payload) return null;
  const d = payload as Partial<Draft>;
  if (!Array.isArray(d.blocks)) return null;
  return {
    work_date: typeof d.work_date === "string" ? d.work_date : todayJST(),
    business_line_id: typeof d.business_line_id === "string" ? d.business_line_id : "",
    memo: typeof d.memo === "string" ? d.memo : "",
    blocks: d.blocks as CustomerBlockState[],
    report_kind: d.report_kind === "individual" ? "individual" : "site_total",
    saved_at: typeof d.saved_at === "number" ? d.saved_at : Date.now(),
  };
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
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [draftBanner, setDraftBanner] = useState<Draft | null>(null);
  // #7 複数人拠点: 'site_total' = 当日全体の売上報告 (売上計上) / 'individual' = 個人実績 (採算用・売上非計上)
  const [reportKind, setReportKind] = useState<ReportKind>("site_total");

  const businessLines = blQ.data?.items ?? EMPTY_BUSINESS_LINES;

  // Track which (date, business_line) we've already checked for a server
  // draft, so changing the department re-queries exactly once.
  const [draftCheckedKey, setDraftCheckedKey] = useState<string | null>(null);

  // When the department is known (create mode), fetch any server-side draft
  // (一時保存) for this date + business line and offer to restore it.
  useEffect(() => {
    if (isEdit || !businessLineId) return;
    const key = `${workDate}::${businessLineId}`;
    if (draftCheckedKey === key) return;
    let cancelled = false;
    void (async () => {
      try {
        const payload = await fetchReportDraft(workDate, businessLineId);
        const d = toDraft(payload);
        if (!cancelled && d && !isEmptyBlocks(d.blocks)) {
          setDraftBanner(d);
        }
      } catch {
        /* draft fetch is best-effort — ignore */
      } finally {
        if (!cancelled) setDraftCheckedKey(key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, workDate, businessLineId, draftCheckedKey]);

  const restoreDraft = () => {
    if (!draftBanner) return;
    setWorkDate(draftBanner.work_date);
    setBusinessLineId(draftBanner.business_line_id);
    setMemo(draftBanner.memo);
    setBlocks(draftBanner.blocks);
    setReportKind(draftBanner.report_kind);
    setDraftBanner(null);
  };

  const discardDraft = () => {
    if (businessLineId) void deleteReportDraft(workDate, businessLineId).catch(() => {});
    setDraftBanner(null);
  };

  // Auto-save the in-progress draft to the server (create mode only). Debounced
  // ~800ms. Skipped while the user is still deciding whether to restore an
  // existing draft, and requires a business line (the draft key).
  useEffect(() => {
    if (isEdit || draftBanner || !businessLineId) return;
    if (isEmptyBlocks(blocks) && !memo) return;
    const t = setTimeout(() => {
      void saveReportDraft(workDate, businessLineId, {
        work_date: workDate,
        business_line_id: businessLineId,
        memo,
        blocks,
        report_kind: reportKind,
        saved_at: Date.now(),
      }).catch(() => {
        /* autosave is best-effort — ignore transient failures */
      });
    }, 800);
    return () => clearTimeout(t);
  }, [isEdit, draftBanner, workDate, businessLineId, memo, blocks, reportKind]);

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
    setReportKind(s.report_kind === "individual" ? "individual" : "site_total");
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
    setReportKind("site_total");
    setImageFiles([]);
    setImagePreviews([]);
  }, [sessionId]);

  // Manage object URL lifecycle for the previews.
  useEffect(() => {
    if (imageFiles.length === 0) {
      setImagePreviews([]);
      return;
    }
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setImagePreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageFiles]);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting the same file
    if (picked.length === 0) return;

    const valid = picked.filter((f) => {
      if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) {
        toast.error(`${f.name}: 画像ファイルを選択してください`);
        return false;
      }
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`${f.name}: 20MB を超える画像はアップロードできません`);
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;

    setImageFiles((prev) => {
      const room = MAX_REPORT_IMAGES - prev.length;
      if (room <= 0) {
        toast.error(`画像は最大${MAX_REPORT_IMAGES}枚までです`);
        return prev;
      }
      if (valid.length > room) {
        toast.warning(`${MAX_REPORT_IMAGES}枚を超える分は追加されませんでした`);
      }
      return [...prev, ...valid.slice(0, room)];
    });
  };

  const removeImageAt = (idx: number) =>
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));

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
    if (imageFiles.length === 0) return;
    setImageUploading(true);
    try {
      // Look up the just-created session to find the first entry's report id.
      const detail = await apiGet<{ item: ReportSession }>(
        `/api/reports/sessions/${sessionDetailId}`,
      );
      const firstEntry = detail.item.entries[0];
      if (!firstEntry) {
        toast.warning("報告は登録されましたが、画像を紐付けるエントリが見つかりませんでした");
        return;
      }
      const uploaded = await uploadReportImages(imageFiles);
      await attachReportImages(firstEntry.id, uploaded.objectKeys);
      const ratio =
        uploaded.originalBytes > 0
          ? Math.round((1 - uploaded.finalBytes / uploaded.originalBytes) * 100)
          : 0;
      const n = uploaded.objectKeys.length;
      toast.success(
        ratio > 0
          ? `画像${n}枚を添付しました（${formatBytes(uploaded.originalBytes)} → ${formatBytes(uploaded.finalBytes)}、${ratio}%削減）`
          : `画像${n}枚を添付しました（${formatBytes(uploaded.finalBytes)}）`,
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
      report_kind: reportKind,
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
        // The submitted session supersedes any draft for this date+department.
        if (businessLineId) {
          void deleteReportDraft(workDate, businessLineId).catch(() => {});
        }
        setMemo("");
        setBlocks([newBlock()]);
        setImageFiles([]);
        setDraftCheckedKey(null);
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

          {/* #7 複数人拠点: report kind — 当日全体(売上計上) vs 個人実績(採算用) */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">報告区分</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={reportKind === "site_total" ? "default" : "outline"}
                className="h-auto flex-col items-start gap-0.5 py-2 text-left"
                onClick={() => setReportKind("site_total")}
              >
                <span className="text-sm font-medium">当日全体の売上報告</span>
                <span className="text-[10px] font-normal opacity-80">売上に計上されます</span>
              </Button>
              <Button
                type="button"
                variant={reportKind === "individual" ? "default" : "outline"}
                className="h-auto flex-col items-start gap-0.5 py-2 text-left"
                onClick={() => setReportKind("individual")}
              >
                <span className="text-sm font-medium">個人の実績</span>
                <span className="text-[10px] font-normal opacity-80">採算確認用・売上に計上しません</span>
              </Button>
            </div>
            {reportKind === "individual" && (
              <p className="text-[11px] text-muted-foreground">
                この報告は個人の作業記録として保存され、売上集計には含まれません。当日の拠点全体の売上は、リーダーが「当日全体の売上報告」として別途入力してください。
              </p>
            )}
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

      {/* Dispatch labour costs attach to an existing session (edit mode only). */}
      {isEdit && sessionId && <DispatchLaborEditor sessionId={sessionId} />}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              報告画像（任意・最大{MAX_REPORT_IMAGES}枚）
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {imageFiles.length}/{MAX_REPORT_IMAGES}枚（残り{MAX_REPORT_IMAGES - imageFiles.length}枚）
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {imagePreviews.map((src, i) => (
                <div key={src} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL preview; next/image can't optimise it */}
                  <img
                    src={src}
                    alt={`選択した画像 ${i + 1}`}
                    className="aspect-square w-full rounded-md border object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-1 top-1 h-6 w-6"
                    onClick={() => removeImageAt(i)}
                    aria-label={`画像 ${i + 1} を削除`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {imageFiles.length < MAX_REPORT_IMAGES ? (
            <Label
              htmlFor="report-image-input"
              className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/40"
            >
              <span>タップして画像を選択（複数選択可・JPEG / PNG / HEIC / WebP）</span>
              <span className="text-[10px] text-muted-foreground/80">
                あと{MAX_REPORT_IMAGES - imageFiles.length}枚追加できます
              </span>
            </Label>
          ) : (
            <p className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">
              最大{MAX_REPORT_IMAGES}枚に達しました（追加するには画像を削除してください）
            </p>
          )}
          <Input
            id="report-image-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            multiple
            className="hidden"
            onChange={onPickImage}
          />
          {imageFiles.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              送信時に自動圧縮されます
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
