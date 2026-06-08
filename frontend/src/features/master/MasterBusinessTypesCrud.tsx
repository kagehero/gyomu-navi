"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus, Trash2, Loader2, Briefcase } from "lucide-react";
import { DataList } from "@/components/ui/data-list";
import { SearchInput } from "@/components/ui/search-input";
import { useTextSearch } from "@/hooks/use-text-search";
import { toast } from "sonner";
import {
  useBusinessLines,
  useBusinessTypes,
  useClients,
  useCreateBusinessType,
  useDeleteBusinessType,
  useSites,
  useUpdateBusinessType,
  type BusinessType,
} from "@/features/master/api";
import { DeleteConfirmDialog } from "@/features/master/DeleteConfirmDialog";

const NONE = "_none_";

const schema = z.object({
  client_id: z.string().uuid("顧客を選んでください"),
  name: z.string().trim().min(1, "業務名を入力してください").max(100),
  site_id: z.string(),
  business_line_id: z.string(),
  unit_price_excl: z.string(),
  unit_price_incl: z.string(),
});
type FormValues = z.infer<typeof schema>;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "操作に失敗しました";
}

function parseOptionalPrice(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function BusinessTypeFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: BusinessType | null;
}) {
  const clientsQ = useClients();
  const sitesQ = useSites();
  const blQ = useBusinessLines();
  const createM = useCreateBusinessType();
  const updateM = useUpdateBusinessType();
  const isEdit = initial !== null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      client_id: initial?.client_id ?? "",
      name: initial?.name ?? "",
      site_id: initial?.site_id ?? NONE,
      business_line_id: initial?.business_line_id ?? NONE,
      unit_price_excl:
        initial?.unit_price_excl != null ? String(initial.unit_price_excl) : "",
      unit_price_incl:
        initial?.unit_price_incl != null ? String(initial.unit_price_incl) : "",
    },
  });

  const clientId = form.watch("client_id");
  const clientSites = (sitesQ.data?.items ?? []).filter((s) => s.client_id === clientId);

  const submit = form.handleSubmit(async (v) => {
    const payload = {
      client_id: v.client_id,
      name: v.name,
      site_id: v.site_id === NONE ? null : v.site_id,
      business_line_id: v.business_line_id === NONE ? null : v.business_line_id,
      unit_price_excl: parseOptionalPrice(v.unit_price_excl),
      unit_price_incl: parseOptionalPrice(v.unit_price_incl),
    };
    try {
      if (isEdit) {
        await updateM.mutateAsync({ id: initial!.id, ...payload });
        toast.success("業務内容を更新しました");
      } else {
        await createM.mutateAsync(payload);
        toast.success("業務内容を作成しました");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const pending = createM.isPending || updateM.isPending;
  const clients = clientsQ.data?.items ?? [];
  const businessLines = blQ.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "業務内容を編集" : "業務内容を新規作成"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">顧客</Label>
            <Select
              value={form.watch("client_id")}
              onValueChange={(v) => {
                form.setValue("client_id", v, { shouldValidate: true });
                form.setValue("site_id", NONE);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="顧客を選択" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">拠点（任意）</Label>
            <Select
              value={form.watch("site_id")}
              onValueChange={(v) => form.setValue("site_id", v)}
              disabled={!clientId}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="指定なし" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>指定なし</SelectItem>
                {clientSites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">報告部門（任意）</Label>
            <Select
              value={form.watch("business_line_id")}
              onValueChange={(v) => form.setValue("business_line_id", v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="指定なし" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>指定なし</SelectItem>
                {businessLines.map((bl) => (
                  <SelectItem key={bl.id} value={bl.id}>
                    {bl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">業務名</Label>
            <Input className="h-10" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">単価（税抜）</Label>
              <Input type="number" step="0.01" className="h-10" {...form.register("unit_price_excl")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">単価（税込）</Label>
              <Input type="number" step="0.01" className="h-10" {...form.register("unit_price_incl")} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "更新" : "作成"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ALL = "_all_";

export default function MasterBusinessTypesCrud() {
  const listQ = useBusinessTypes();
  const clientsQ = useClients();
  const sitesQ = useSites();
  const deleteM = useDeleteBusinessType();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessType | null>(null);
  const [deleting, setDeleting] = useState<BusinessType | null>(null);
  const [clientFilter, setClientFilter] = useState<string>(ALL);
  const [siteFilter, setSiteFilter] = useState<string>(ALL);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (b: BusinessType) => {
    setEditing(b);
    setFormOpen(true);
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteM.mutateAsync(deleting.id);
      toast.success("業務内容を削除しました");
      setDeleting(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const items = listQ.data?.items ?? [];
  const clients = clientsQ.data?.items ?? [];

  // When a client is selected, the 拠点 dropdown only offers that client's
  // sites; "すべての顧客" exposes every site so the filter is still usable.
  const filterSites = (sitesQ.data?.items ?? []).filter(
    (s) => clientFilter === ALL || s.client_id === clientFilter,
  );

  const filtered = items.filter(
    (b) =>
      (clientFilter === ALL || b.client_id === clientFilter) &&
      (siteFilter === ALL || b.site_id === siteFilter),
  );

  const { query, setQuery, results } = useTextSearch(filtered, (b) => [
    b.name,
    b.client_name,
    b.site_name,
    b.business_line_name,
  ]);

  // Changing the client invalidates any site selection from another client.
  const onClientFilterChange = (v: string) => {
    setClientFilter(v);
    setSiteFilter(ALL);
  };

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">
            業務内容一覧 ({results.length}/{items.length}件)
          </CardTitle>
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 shrink-0" onClick={openCreate}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                新規作成
              </Button>
            </DialogTrigger>
            <BusinessTypeFormDialog
              open={formOpen}
              onOpenChange={setFormOpen}
              initial={editing}
            />
          </Dialog>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={clientFilter} onValueChange={onClientFilterChange}>
              <SelectTrigger className="h-9 w-full sm:w-44">
                <SelectValue placeholder="顧客で絞り込み" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>すべての顧客</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="h-9 w-full sm:w-44">
                <SelectValue placeholder="拠点で絞り込み" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>すべての拠点</SelectItem>
                {filterSites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="業務名・顧客名・拠点・部門で検索"
            className="w-full sm:max-w-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-0">
        <DataList
          items={results}
          isLoading={listQ.isLoading}
          error={listQ.isError ? listQ.error : undefined}
          getKey={(b) => b.id}
          empty={{
            icon: Briefcase,
            title: query ? "該当する業務内容がありません" : "業務内容がありません",
            description: query ? `「${query}」に一致する業務内容は見つかりませんでした` : undefined,
          }}
          renderCard={(b) => (
            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{b.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.client_name}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => openEdit(b)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => setDeleting(b)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>拠点: {b.site_name ?? "—"}</span>
                <span>部門: {b.business_line_name ?? "—"}</span>
                <span className="font-medium text-foreground">
                  {b.unit_price_incl != null ? `¥${Math.round(b.unit_price_incl).toLocaleString()}` : "単価—"}
                </span>
              </div>
            </div>
          )}
          table={{
            minWidth: 720,
            head: (
              <tr>
                <th>業務名</th>
                <th>顧客</th>
                <th>拠点</th>
                <th>報告部門</th>
                <th className="text-right">単価(税込)</th>
                <th className="w-24 text-right">操作</th>
              </tr>
            ),
            renderRow: (b) => (
              <tr>
                <td className="text-sm font-medium">{b.name}</td>
                <td className="text-sm">{b.client_name}</td>
                <td className="text-sm text-muted-foreground">{b.site_name ?? "—"}</td>
                <td className="text-sm text-muted-foreground">{b.business_line_name ?? "—"}</td>
                <td className="text-right text-sm">
                  {b.unit_price_incl != null
                    ? `¥${Math.round(b.unit_price_incl).toLocaleString()}`
                    : "—"}
                </td>
                <td className="text-right">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(b)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleting(b)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ),
          }}
        />
      </CardContent>

      <DeleteConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`業務内容「${deleting?.name ?? ""}」を削除しますか？`}
        description="この業務内容を参照している報告がある場合は削除できません。"
        pending={deleteM.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
