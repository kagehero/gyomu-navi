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
import { Plus, Trash2, Loader2, Building2, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { todayJST } from "@/lib/dates";
import { apiGet, apiPatch } from "@/lib/api";
import {
  uploadReportImage,
  useCreateReportSession,
  useMyBusinessLines,
  useMyReportBusinessTypes,
  useMyReportClients,
  useMyReportSites,
  useMyReportVehicles,
  useReportSession,
  useUpdateReportSession,
  type CustomerBlock,
  type ReportSession,
  type SessionEntry,
  type ReportBusinessType,
} from "@/features/reports/api";
import { formatBytes } from "@/lib/reports/image-compression";
import {
  INPUT_UNIT_LABELS,
  LINE_MEMO_FIELD_LABELS,
  type LineMemoField,
} from "@/lib/reports/business-type-rules";

type LineRow = SessionEntry & { key: string };
type CustomerBlockState = {
  key: string;
  client_id: string;
  site_id: string;
  lines: LineRow[];
};

function newLine(): LineRow {
  return {
    key: crypto.randomUUID(),
    business_type_id: "",
    count: 0,
    vehicle_id: null,
    line_memo: null,
  };
}

function newBlock(): CustomerBlockState {
  return { key: crypto.randomUUID(), client_id: "", site_id: "", lines: [newLine()] };
}

const EMPTY_BUSINESS_LINES: { id: string; name: string; client_count?: number }[] = [];

function sessionToBlocks(session: ReportSession): CustomerBlockState[] {
  const map = new Map<string, CustomerBlockState>();
  for (const e of session.entries) {
    const key = `${e.client_id}:${e.site_id}`;
    let block = map.get(key);
    if (!block) {
      block = {
        key: crypto.randomUUID(),
        client_id: e.client_id,
        site_id: e.site_id,
        lines: [],
      };
      map.set(key, block);
    }
    block.lines.push({
      key: crypto.randomUUID(),
      business_type_id: e.business_type_id,
      count: e.count,
      vehicle_id: e.vehicle_id ?? null,
      line_memo: e.line_memo ?? null,
    });
  }
  const blocks = [...map.values()];
  return blocks.length ? blocks : [newBlock()];
}

function CustomerBlockEditor({
  block,
  businessLineId,
  onChange,
  onRemove,
  canRemove,
}: {
  block: CustomerBlockState;
  businessLineId: string;
  onChange: (b: CustomerBlockState) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const clientsQ = useMyReportClients(businessLineId);
  const clients = clientsQ.data?.items ?? [];

  const resolvedClientId =
    block.client_id || (clients.length === 1 ? clients[0]!.id : "");

  const sitesQ = useMyReportSites(resolvedClientId || null);
  const sites = sitesQ.data?.items ?? [];

  const resolvedSiteId =
    block.site_id || (sites.length === 1 ? sites[0]!.id : "");

  const siteRequired = sites.length > 1;
  const canPickBusinessTypes =
    !!resolvedClientId && (!siteRequired || !!resolvedSiteId);

  const btsQ = useMyReportBusinessTypes(
    businessLineId,
    resolvedClientId || null,
    resolvedSiteId || null,
    canPickBusinessTypes,
  );
  const bts = btsQ.data?.items ?? [];

  const vehiclesQ = useMyReportVehicles(resolvedClientId || null, businessLineId);
  const vehicles = vehiclesQ.data?.items ?? [];

  const btById = useMemo(() => new Map(bts.map((b) => [b.id, b])), [bts]);

  const clientsReady = !clientsQ.isLoading && !clientsQ.isFetching;
  const sitesReady = !resolvedClientId || (!sitesQ.isLoading && !sitesQ.isFetching);
  const btsReady =
    !resolvedClientId || (!btsQ.isLoading && !btsQ.isFetching);

  // Clear business types that no longer match the selected department / client / site.
  useEffect(() => {
    if (!btsReady || !canPickBusinessTypes) return;
    const allowed = new Set(bts.map((b) => b.id));
    const stale = block.lines.some(
      (l) =>
        (l.business_type_id && !allowed.has(l.business_type_id)) ||
        (l.vehicle_id && !vehicles.some((v) => v.id === l.vehicle_id)),
    );
    if (!stale) return;
    onChange({
      ...block,
      lines: block.lines.map((l) =>
        l.business_type_id && !allowed.has(l.business_type_id)
          ? { ...l, business_type_id: "", count: 0, vehicle_id: null, line_memo: null }
          : l.vehicle_id && !vehicles.some((v) => v.id === l.vehicle_id)
            ? { ...l, vehicle_id: null }
            : l,
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prune stale line selections when scope changes
  }, [businessLineId, resolvedClientId, resolvedSiteId, btsReady, canPickBusinessTypes, bts, vehicles]);

  const showSiteSelect = sites.length > 1;
  const singleSiteName = sites.length === 1 ? sites[0]!.name : null;

  // Sync auto-resolved client/site into block state for submit payload.
  useEffect(() => {
    const patch: Partial<CustomerBlockState> = {};
    if (!block.client_id && clients.length === 1 && clients[0]) {
      patch.client_id = clients[0].id;
      patch.site_id = "";
      patch.lines = [newLine()];
    }
    const clientId = patch.client_id ?? block.client_id;
    if (clientId && !block.site_id && sites.length === 1 && sites[0]) {
      patch.site_id = sites[0].id;
    }
    if (Object.keys(patch).length > 0) {
      onChange({ ...block, ...patch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync derived defaults once lists load
  }, [clients.length, sites.length, block.client_id, block.site_id]);

  const vehicleLabel = (mode: ReportBusinessType["vehicle_select_mode"]) => {
    if (mode === "station") return "ステーション";
    if (mode === "plate") return "車番";
    return "車両";
  };

  const renderVehicleOptions = (mode: ReportBusinessType["vehicle_select_mode"]) => {
    if (mode === "station") {
      const seen = new Set<string>();
      return vehicles.filter((v) => {
        const label = v.station_name ?? v.vehicle_label;
        if (seen.has(label)) return false;
        seen.add(label);
        return true;
      });
    }
    return vehicles;
  };

  const vehicleOptionLabel = (
    v: (typeof vehicles)[number],
    mode: ReportBusinessType["vehicle_select_mode"],
  ) => {
    if (mode === "station") return v.station_name ?? v.vehicle_label;
    return v.station_name ? `${v.station_name} / ${v.vehicle_label}` : v.vehicle_label;
  };

  const updateLine = (idx: number, patch: Partial<LineRow>) => {
    const lines = block.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    onChange({ ...block, lines });
  };

  const updateLineMemo = (idx: number, field: LineMemoField, value: string) => {
    const line = block.lines[idx]!;
    updateLine(idx, {
      line_memo: { ...(line.line_memo ?? {}), [field]: value },
    });
  };

  const parseCount = (raw: string, unit: ReportBusinessType["input_unit"]) => {
    if (raw.trim() === "") return 0;
    const n = unit === "count" ? parseInt(raw, 10) : parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const addLine = () => onChange({ ...block, lines: [...block.lines, newLine()] });
  const removeLine = (idx: number) => {
    const lines = block.lines.filter((_, i) => i !== idx);
    onChange({ ...block, lines: lines.length ? lines : [newLine()] });
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4 text-primary" />
          顧客ブロック
        </CardTitle>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">顧客名</Label>
            <Select
              value={resolvedClientId || undefined}
              onValueChange={(v) =>
                onChange({ ...block, client_id: v, site_id: "", lines: [newLine()] })
              }
              disabled={!businessLineId || !clientsReady || clients.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={clientsQ.isLoading ? "読み込み中…" : "選択"} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientsReady && clients.length === 0 && (
              <p className="text-xs text-muted-foreground">
                この部門に担当顧客がありません。管理者に連絡してください。
              </p>
            )}
          </div>
          {resolvedClientId && (
            <div className="space-y-1.5">
              <Label className="text-xs">拠点名</Label>
              {showSiteSelect ? (
                <Select
                  value={resolvedSiteId || undefined}
                  onValueChange={(v) =>
                    onChange({ ...block, site_id: v, lines: [newLine()] })
                  }
                  disabled={!sitesReady || sites.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={sitesQ.isLoading ? "読み込み中…" : "選択"} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">
                  {sitesQ.isLoading
                    ? "読み込み中…"
                    : singleSiteName ?? (sitesReady ? "拠点なし" : "—")}
                </div>
              )}
              {sitesReady && sites.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  この顧客に利用可能な拠点がありません。
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {block.lines.map((line, idx) => {
            const bt = line.business_type_id ? btById.get(line.business_type_id) : undefined;
            const inputUnit = bt?.input_unit ?? "count";
            const countLabel = INPUT_UNIT_LABELS[inputUnit];
            const vehicleMode = bt?.vehicle_select_mode ?? null;
            const memoFields = bt?.line_memo_fields ?? [];
            const vehicleOptions = vehicleMode ? renderVehicleOptions(vehicleMode) : [];

            return (
              <div key={line.key} className="space-y-2 rounded-lg border bg-muted/20 p-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">業務内容</Label>
                    <Select
                      value={line.business_type_id || undefined}
                      onValueChange={(v) =>
                        updateLine(idx, {
                          business_type_id: v,
                          count: 0,
                          vehicle_id: null,
                          line_memo: null,
                        })
                      }
                      disabled={!canPickBusinessTypes || !btsReady || bts.length === 0}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue
                          placeholder={
                            !resolvedClientId
                              ? "顧客を選択"
                              : siteRequired && !resolvedSiteId
                                ? "拠点を選択"
                                : btsQ.isLoading
                                  ? "読み込み中…"
                                  : "選択"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {bts.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {vehicleMode && (
                    <div className="min-w-[180px] flex-1 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        {vehicleLabel(vehicleMode)}
                      </Label>
                      <Select
                        value={line.vehicle_id || undefined}
                        onValueChange={(v) => updateLine(idx, { vehicle_id: v })}
                        disabled={vehiclesQ.isLoading || vehicleOptions.length === 0}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue
                            placeholder={
                              vehiclesQ.isLoading
                                ? "読み込み中…"
                                : vehicleOptions.length === 0
                                  ? "車両リストなし"
                                  : "選択"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {vehicleOptions.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {vehicleOptionLabel(v, vehicleMode)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="w-24 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{countLabel}</Label>
                    <Input
                      type="number"
                      min={0}
                      step={inputUnit === "count" ? 1 : 0.5}
                      className="h-9"
                      value={line.count || ""}
                      onChange={(e) =>
                        updateLine(idx, { count: parseCount(e.target.value, inputUnit) })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => removeLine(idx)}
                    disabled={block.lines.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {memoFields.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {memoFields.map((field) => (
                      <div key={field} className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          {LINE_MEMO_FIELD_LABELS[field]}
                        </Label>
                        <Input
                          className="h-9"
                          value={line.line_memo?.[field] ?? ""}
                          onChange={(e) => updateLineMemo(idx, field, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addLine}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            項目追加
          </Button>
          {btsReady && canPickBusinessTypes && bts.length === 0 && (
            <p className="text-xs text-muted-foreground">
              選択した部門・顧客・拠点に該当する業務内容がありません。
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
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

  const businessLines = blQ.data?.items ?? EMPTY_BUSINESS_LINES;

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
