"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Building2, Car, Check, Plus, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  useMyReportBusinessTypes,
  useMyReportClients,
  useMyReportSites,
  useMyReportVehicles,
  type ReportBusinessType,
  type ReportSession,
  type SessionEntry,
} from "@/features/reports/api";
import {
  INPUT_UNIT_LABELS,
  LINE_MEMO_FIELD_LABELS,
  type LineMemoField,
} from "@/lib/reports/business-type-rules";

/**
 * One customer×site block in the report-entry form. Owns its own data fetching
 * (clients → sites → business types → vehicles) and emits state changes back
 * up to the form via onChange. Kept in its own file because the editor is
 * roughly half of the form's complexity and is the only piece that changes
 * frequently as business rules evolve.
 */

export type LineRow = SessionEntry & { key: string };
export type CustomerBlockState = {
  key: string;
  client_id: string;
  site_id: string;
  lines: LineRow[];
};

export function newLine(): LineRow {
  return {
    key: crypto.randomUUID(),
    business_type_id: "",
    count: 0,
    vehicle_id: null,
    line_memo: null,
  };
}

export function newBlock(): CustomerBlockState {
  return { key: crypto.randomUUID(), client_id: "", site_id: "", lines: [newLine()] };
}

export function sessionToBlocks(session: ReportSession): CustomerBlockState[] {
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

/**
 * Multi-select for vehicles/車番 (顧客要望: 車番一覧から複数選択). Lets the user
 * tick several vehicles at once; on confirm the parent expands each into its
 * own report line (1車番 = 1台). Vehicles already chosen for this business type
 * in the block are pre-checked and disabled so they aren't duplicated.
 */
function VehicleMultiSelect({
  options,
  optionLabel,
  alreadySelected,
  onConfirm,
  disabled,
}: {
  options: { id: string; label: string }[];
  optionLabel: string;
  alreadySelected: Set<string>;
  onConfirm: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Reset transient checks whenever the popover closes.
  useEffect(() => {
    if (!open) setChecked(new Set());
  }, [open]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    if (checked.size > 0) onConfirm([...checked]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9" disabled={disabled}>
          <Car className="mr-1 h-3.5 w-3.5" />
          {optionLabel}を複数選択
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={`${optionLabel}を検索…`} />
          <CommandList>
            <CommandEmpty>該当なし</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const used = alreadySelected.has(o.id);
                const isChecked = used || checked.has(o.id);
                return (
                  <CommandItem
                    key={o.id}
                    value={o.label}
                    disabled={used}
                    onSelect={() => !used && toggle(o.id)}
                  >
                    <span
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded border",
                        isChecked ? "bg-primary text-primary-foreground" : "opacity-50",
                      )}
                    >
                      {isChecked && <Check className="h-3 w-3" />}
                    </span>
                    <span className={cn("truncate", used && "text-muted-foreground")}>
                      {o.label}
                      {used && "（選択済み）"}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between border-t p-2">
            <span className="text-xs text-muted-foreground">{checked.size}件選択中</span>
            <Button type="button" size="sm" className="h-8" onClick={confirm} disabled={checked.size === 0}>
              追加
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CustomerBlockEditor({
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
  // Memoize derived arrays so dependent hooks (btById, the stale-prune effect)
  // don't see a fresh identity on every render.
  const bts = useMemo(() => btsQ.data?.items ?? [], [btsQ.data?.items]);

  const vehiclesQ = useMyReportVehicles(resolvedClientId || null, businessLineId);
  const vehicles = useMemo(() => vehiclesQ.data?.items ?? [], [vehiclesQ.data?.items]);

  const btById = useMemo(() => new Map(bts.map((b) => [b.id, b])), [bts]);

  const clientsReady = !clientsQ.isLoading && !clientsQ.isFetching;
  const sitesReady = !resolvedClientId || (!sitesQ.isLoading && !sitesQ.isFetching);
  const btsReady = !resolvedClientId || (!btsQ.isLoading && !btsQ.isFetching);

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

  /**
   * Expand a multi-vehicle pick into one line per vehicle (1車番 = 1台). The
   * base line at `idx` adopts the first vehicle; the rest are appended right
   * after it, carrying the same business type and any line memo.
   */
  const addVehiclesToLine = (idx: number, vehicleIds: string[]) => {
    if (vehicleIds.length === 0) return;
    const base = block.lines[idx]!;
    const [first, ...rest] = vehicleIds;
    const baseLine: LineRow = {
      ...base,
      vehicle_id: first!,
      count: base.count > 0 ? base.count : 1,
    };
    const extraLines: LineRow[] = rest.map((vid) => ({
      key: crypto.randomUUID(),
      business_type_id: base.business_type_id,
      count: 1,
      vehicle_id: vid,
      line_memo: base.line_memo ?? null,
    }));
    const lines = [
      ...block.lines.slice(0, idx),
      baseLine,
      ...extraLines,
      ...block.lines.slice(idx + 1),
    ];
    onChange({ ...block, lines });
  };

  /** Vehicle ids already chosen for a given business type across the block. */
  const vehiclesUsedFor = (businessTypeId: string): Set<string> =>
    new Set(
      block.lines
        .filter((l) => l.business_type_id === businessTypeId && l.vehicle_id)
        .map((l) => l.vehicle_id!),
    );

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
                      {line.business_type_id && vehicleOptions.length > 1 && (
                        <VehicleMultiSelect
                          optionLabel={vehicleLabel(vehicleMode)}
                          options={vehicleOptions.map((v) => ({
                            id: v.id,
                            label: vehicleOptionLabel(v, vehicleMode),
                          }))}
                          alreadySelected={vehiclesUsedFor(line.business_type_id)}
                          onConfirm={(ids) => addVehiclesToLine(idx, ids)}
                          disabled={vehiclesQ.isLoading}
                        />
                      )}
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
