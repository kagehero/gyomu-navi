"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, Plus, Trash2, Loader2, Building2 } from "lucide-react";
import { DataList } from "@/components/ui/data-list";
import { toast } from "sonner";
import {
  useBusinessLines,
  useClients,
  useCreateClient,
  useDeleteClient,
  useUpdateClient,
  type BusinessLine,
  type ClientCompany,
} from "@/features/master/api";
import { DeleteConfirmDialog } from "@/features/master/DeleteConfirmDialog";

const schema = z.object({
  name: z.string().trim().min(1, "企業名を入力してください").max(255),
  code: z.string().trim().min(1, "コードを入力してください").max(20),
  business_line_ids: z.array(z.string().uuid()),
});
type FormValues = z.infer<typeof schema>;

const ALL_DEPARTMENTS = "all";
const UNASSIGNED = "unassigned";
const EMPTY_BL: BusinessLine[] = [];

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "操作に失敗しました";
}

function ClientFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ClientCompany | null;
}) {
  const blQ = useBusinessLines();
  const createM = useCreateClient();
  const updateM = useUpdateClient();
  const isEdit = initial !== null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      business_line_ids: initial?.business_line_ids ?? [],
    },
  });

  const selectedBlIds = new Set(form.watch("business_line_ids"));
  const toggleBl = (id: string) => {
    const next = new Set(selectedBlIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    form.setValue("business_line_ids", [...next], { shouldValidate: true });
  };

  const submit = form.handleSubmit(async (v) => {
    try {
      if (isEdit) {
        await updateM.mutateAsync({ id: initial!.id, ...v });
        toast.success("顧客を更新しました");
      } else {
        await createM.mutateAsync(v);
        toast.success("顧客を作成しました");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const pending = createM.isPending || updateM.isPending;
  const businessLines = blQ.data?.items ?? EMPTY_BL;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "顧客を編集" : "顧客を新規作成"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">企業名</Label>
            <Input className="h-10" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">コード</Label>
            <Input className="h-10" {...form.register("code")} />
            {form.formState.errors.code && (
              <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">報告部門</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
              {businessLines.map((bl) => (
                <label key={bl.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={selectedBlIds.has(bl.id)} onCheckedChange={() => toggleBl(bl.id)} />
                  {bl.name}
                </label>
              ))}
              {businessLines.length === 0 && (
                <p className="text-xs text-muted-foreground">報告部門がありません</p>
              )}
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

function clientBlBadges(c: ClientCompany, blMap: Map<string, string>) {
  const ids = c.business_line_ids ?? [];
  if (ids.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <Badge key={`${c.id}-${id}`} variant="secondary" className="text-[10px] font-normal">
          {blMap.get(id) ?? id}
        </Badge>
      ))}
    </div>
  );
}

function ClientsTable({
  clients,
  blMap,
  onEdit,
  onDelete,
  emptyMessage,
}: {
  clients: ClientCompany[];
  blMap: Map<string, string>;
  onEdit: (c: ClientCompany) => void;
  onDelete: (c: ClientCompany) => void;
  emptyMessage: string;
}) {
  return (
    <DataList
      items={clients}
      getKey={(c) => c.id}
      empty={{ icon: Building2, title: emptyMessage || "顧客がありません" }}
      renderCard={(c) => (
        <div className="rounded-xl border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <p className="text-xs text-muted-foreground">コード: {c.code}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => onEdit(c)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => onDelete(c)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-2">{clientBlBadges(c, blMap)}</div>
        </div>
      )}
      table={{
        minWidth: 600,
        head: (
          <tr>
            <th>企業名</th>
            <th>コード</th>
            <th>報告部門</th>
            <th className="w-24 text-right">操作</th>
          </tr>
        ),
        renderRow: (c) => (
          <tr>
            <td className="text-sm font-medium">{c.name}</td>
            <td className="text-sm text-muted-foreground">{c.code}</td>
            <td className="text-sm">{clientBlBadges(c, blMap)}</td>
            <td className="text-right">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onDelete(c)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </td>
          </tr>
        ),
      }}
    />
  );
}

export default function MasterClientsCrud() {
  const listQ = useClients();
  const blQ = useBusinessLines();
  const deleteM = useDeleteClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientCompany | null>(null);
  const [deleting, setDeleting] = useState<ClientCompany | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS);

  const businessLines = blQ.data?.items ?? EMPTY_BL;
  const blMap = useMemo(
    () => new Map(businessLines.map((bl) => [bl.id, bl.name])),
    [businessLines],
  );
  // Memoize the list so downstream useMemo deps don't re-fire on every render
  // (listQ.data?.items ?? [] would mint a fresh empty array each pass).
  const items = useMemo(() => listQ.data?.items ?? [], [listQ.data?.items]);

  const clientCountByBl = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bl of businessLines) counts.set(bl.id, 0);
    let unassigned = 0;
    for (const c of items) {
      const ids = c.business_line_ids ?? [];
      if (ids.length === 0) {
        unassigned++;
      } else {
        for (const id of ids) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }
    return { byBl: counts, unassigned };
  }, [items, businessLines]);

  const filteredClients = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, "ja"));
    if (departmentFilter === ALL_DEPARTMENTS) return sorted;
    if (departmentFilter === UNASSIGNED) {
      return sorted.filter((c) => (c.business_line_ids ?? []).length === 0);
    }
    return sorted.filter((c) => (c.business_line_ids ?? []).includes(departmentFilter));
  }, [items, departmentFilter]);

  const groupedSections = useMemo(() => {
    if (departmentFilter !== ALL_DEPARTMENTS) return [];
    return businessLines
      .map((bl) => ({
        bl,
        clients: items
          .filter((c) => (c.business_line_ids ?? []).includes(bl.id))
          .sort((a, b) => a.name.localeCompare(b.name, "ja")),
      }))
      .filter((s) => s.clients.length > 0);
  }, [items, businessLines, departmentFilter]);

  const unassignedClients = useMemo(() => {
    if (departmentFilter !== ALL_DEPARTMENTS) return [];
    return items
      .filter((c) => (c.business_line_ids ?? []).length === 0)
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }, [items, departmentFilter]);

  const filterLabel = useMemo(() => {
    if (departmentFilter === ALL_DEPARTMENTS) return "すべての報告部門";
    if (departmentFilter === UNASSIGNED) return "報告部門未設定";
    return blMap.get(departmentFilter) ?? "報告部門";
  }, [departmentFilter, blMap]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (c: ClientCompany) => {
    setEditing(c);
    setFormOpen(true);
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteM.mutateAsync(deleting.id);
      toast.success("顧客を削除しました");
      setDeleting(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-medium">顧客一覧 ({items.length}件)</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              報告部門ごとに顧客を確認できます（複数部門に属する顧客は各部門に表示されます）
            </p>
          </div>
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 shrink-0" onClick={openCreate}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                新規作成
              </Button>
            </DialogTrigger>
            <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} />
          </Dialog>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label className="text-xs">報告部門で絞り込み</Label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="h-9 w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="z-[100]">
                <SelectItem value={ALL_DEPARTMENTS}>すべての報告部門</SelectItem>
                {businessLines.map((bl) => (
                  <SelectItem key={bl.id} value={bl.id}>
                    {bl.name}（{clientCountByBl.byBl.get(bl.id) ?? 0}件）
                  </SelectItem>
                ))}
                {clientCountByBl.unassigned > 0 && (
                  <SelectItem value={UNASSIGNED}>
                    報告部門未設定（{clientCountByBl.unassigned}件）
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {departmentFilter !== ALL_DEPARTMENTS && (
            <p className="text-xs text-muted-foreground sm:pt-5">
              表示中: {filterLabel} — {filteredClients.length}件
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {listQ.isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {listQ.isError && (
          <p className="py-6 text-center text-sm text-destructive">{errorMessage(listQ.error)}</p>
        )}

        {!listQ.isLoading && !listQ.isError && departmentFilter !== ALL_DEPARTMENTS && (
          <ClientsTable
            clients={filteredClients}
            blMap={blMap}
            onEdit={openEdit}
            onDelete={setDeleting}
            emptyMessage={`${filterLabel}に該当する顧客がありません`}
          />
        )}

        {!listQ.isLoading && !listQ.isError && departmentFilter === ALL_DEPARTMENTS && (
          <div className="divide-y">
            {groupedSections.map(({ bl, clients }) => (
              <section key={bl.id}>
                <div className="flex items-center gap-2 bg-muted/30 px-4 py-2.5">
                  <Badge variant="outline" className="font-medium">
                    {bl.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{clients.length}件</span>
                </div>
                <ClientsTable
                  clients={clients}
                  blMap={blMap}
                  onEdit={openEdit}
                  onDelete={setDeleting}
                  emptyMessage=""
                />
              </section>
            ))}
            {unassignedClients.length > 0 && (
              <section>
                <div className="flex items-center gap-2 bg-muted/30 px-4 py-2.5">
                  <Badge variant="outline" className="font-medium text-amber-700">
                    報告部門未設定
                  </Badge>
                  <span className="text-xs text-muted-foreground">{unassignedClients.length}件</span>
                </div>
                <ClientsTable
                  clients={unassignedClients}
                  blMap={blMap}
                  onEdit={openEdit}
                  onDelete={setDeleting}
                  emptyMessage=""
                />
              </section>
            )}
            {groupedSections.length === 0 && unassignedClients.length === 0 && (
              <p className="py-6 text-center text-muted-foreground">顧客がありません</p>
            )}
          </div>
        )}
      </CardContent>

      <DeleteConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`顧客「${deleting?.name ?? ""}」を削除しますか？`}
        description="この顧客に紐づく拠点・業務内容・報告がある場合は削除できません。"
        pending={deleteM.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
