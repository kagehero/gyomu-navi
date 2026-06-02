"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import { useClients, useSites, useStaffs } from "@/features/master/api";
import type { AnalyticsFilterState } from "@/features/analytics/utils";

type Props = {
  filters: AnalyticsFilterState;
  onChange: (next: AnalyticsFilterState) => void;
  isAdmin: boolean;
};

export function AnalyticsFilters({ filters, onChange, isAdmin }: Props) {
  const clientsQ = useClients({ enabled: isAdmin });
  const staffsQ = useStaffs({ enabled: isAdmin });
  const sitesQ = useSites({ enabled: isAdmin });

  const set = (patch: Partial<AnalyticsFilterState>) =>
    onChange({ ...filters, ...patch });

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">集計条件</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">開始日</Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={filters.from}
              onChange={(e) => set({ from: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">終了日</Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={filters.to}
              onChange={(e) => set({ to: e.target.value })}
            />
          </div>

          {isAdmin && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">顧客</Label>
                <Select
                  value={filters.client_id}
                  onValueChange={(v) => set({ client_id: v })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {(clientsQ.data?.items ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">スタッフ</Label>
                <Select
                  value={filters.staff_id}
                  onValueChange={(v) => set({ staff_id: v })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {(staffsQ.data?.items ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">拠点</Label>
                <Select
                  value={filters.site_id}
                  onValueChange={(v) => set({ site_id: v })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {(sitesQ.data?.items ?? []).map((s) => (
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
      </CardContent>
    </Card>
  );
}
