"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  useDispatchLabor,
  useReplaceDispatchLabor,
  type DispatchLaborCost,
} from "@/features/reports/api";

/**
 * Editor for external (派遣) staff labour costs on a submitted session
 * (顧客要望: 派遣スタッフの人件費のみ追加入力 → 当日の収支に反映). The leader adds a
 * name + worked hours + labour cost per dispatch worker. These never affect
 * revenue; the analytics P&L subtracts them to show 現場の収支.
 */
type Row = DispatchLaborCost & { key: string };

const emptyRow = (): Row => ({
  key: crypto.randomUUID(),
  name: "",
  hours: 0,
  labor_cost: 0,
});

export function DispatchLaborEditor({ sessionId }: { sessionId: string }) {
  const listQ = useDispatchLabor(sessionId);
  const saveM = useReplaceDispatchLabor(sessionId);
  const [rows, setRows] = useState<Row[]>([]);

  // Seed local rows from the server once loaded.
  useEffect(() => {
    if (!listQ.data) return;
    setRows(
      listQ.data.items.length > 0
        ? listQ.data.items.map((i) => ({ ...i, key: crypto.randomUUID() }))
        : [emptyRow()],
    );
  }, [listQ.data]);

  const update = (idx: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx: number) =>
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [emptyRow()];
    });

  const totalCost = rows.reduce((sum, r) => sum + (r.labor_cost || 0), 0);

  const onSave = async () => {
    const items = rows
      .filter((r) => r.name.trim())
      .map(({ name, hours, labor_cost }) => ({
        name: name.trim(),
        hours: Number(hours) || 0,
        labor_cost: Number(labor_cost) || 0,
      }));
    try {
      await saveM.mutateAsync(items);
      toast.success("派遣人件費を保存しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-primary" />
          派遣スタッフの人件費（任意・収支に反映）
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {listQ.isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {rows.map((row, idx) => (
              <div key={row.key} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[140px] flex-1 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">派遣スタッフ名</Label>
                  <Input
                    className="h-9"
                    value={row.name}
                    placeholder="例：派遣D"
                    onChange={(e) => update(idx, { name: e.target.value })}
                  />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">勤務時間</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    className="h-9"
                    value={row.hours || ""}
                    onChange={(e) => update(idx, { hours: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">人件費(円)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={100}
                    className="h-9"
                    value={row.labor_cost || ""}
                    onChange={(e) => update(idx, { labor_cost: Number(e.target.value) || 0 })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => removeRow(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRow}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              派遣スタッフを追加
            </Button>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-xs text-muted-foreground">
                合計人件費: ¥{Math.round(totalCost).toLocaleString()}
              </span>
              <Button type="button" size="sm" className="h-9" onClick={onSave} disabled={saveM.isPending}>
                {saveM.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                人件費を保存
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
