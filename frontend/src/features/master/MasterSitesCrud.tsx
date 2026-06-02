"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useClients,
  useCreateSite,
  useDeleteSite,
  useSites,
  useUpdateSite,
  type Site,
} from "@/features/master/api";
import { DeleteConfirmDialog } from "@/features/master/DeleteConfirmDialog";

const schema = z.object({
  client_id: z.string().uuid("顧客を選んでください"),
  name: z.string().trim().min(1, "拠点名を入力してください").max(255),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius_m: z.coerce.number().int().positive().max(100_000),
  is_billing_branch: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "操作に失敗しました";
}

function SiteFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Site | null;
}) {
  const clientsQ = useClients();
  const createM = useCreateSite();
  const updateM = useUpdateSite();
  const isEdit = initial !== null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      client_id: initial?.client_id ?? "",
      name: initial?.name ?? "",
      latitude: initial?.latitude ?? 35.6896,
      longitude: initial?.longitude ?? 139.6917,
      radius_m: initial?.radius_m ?? 100,
      is_billing_branch: initial?.is_billing_branch ?? true,
    },
  });

  const submit = form.handleSubmit(async (v) => {
    try {
      if (isEdit) {
        await updateM.mutateAsync({ id: initial!.id, ...v });
        toast.success("拠点を更新しました");
      } else {
        await createM.mutateAsync(v);
        toast.success("拠点を作成しました");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const pending = createM.isPending || updateM.isPending;
  const clients = clientsQ.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "拠点を編集" : "拠点を新規作成"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">顧客</Label>
            <Select
              value={form.watch("client_id")}
              onValueChange={(v) => form.setValue("client_id", v, { shouldValidate: true })}
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
            {form.formState.errors.client_id && (
              <p className="text-xs text-destructive">
                {form.formState.errors.client_id.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">拠点名</Label>
            <Input className="h-10" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={form.watch("is_billing_branch")}
              onCheckedChange={(v) => form.setValue("is_billing_branch", v === true)}
            />
            売上報告用の拠点（支店）
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">緯度</Label>
              <Input
                type="number"
                step="0.000001"
                className="h-10"
                {...form.register("latitude")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">経度</Label>
              <Input
                type="number"
                step="0.000001"
                className="h-10"
                {...form.register("longitude")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">判定半径 (m)</Label>
            <Input type="number" className="h-10" {...form.register("radius_m")} />
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

export default function MasterSitesCrud() {
  const listQ = useSites();
  const deleteM = useDeleteSite();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [deleting, setDeleting] = useState<Site | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Site) => {
    setEditing(s);
    setFormOpen(true);
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteM.mutateAsync(deleting.id);
      toast.success("拠点を削除しました");
      setDeleting(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const items = listQ.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">拠点一覧 ({items.length}件)</CardTitle>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8" onClick={openCreate}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              新規作成
            </Button>
          </DialogTrigger>
          <SiteFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} />
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>拠点名</th>
                <th>顧客</th>
                <th>報告用</th>
                <th className="text-right">判定半径</th>
                <th className="w-24 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {listQ.isLoading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </td>
                </tr>
              )}
              {listQ.isError && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-destructive">
                    {errorMessage(listQ.error)}
                  </td>
                </tr>
              )}
              {items.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="font-medium text-sm">{s.name}</td>
                  <td className="text-sm">{s.client_name}</td>
                  <td className="text-sm">{s.is_billing_branch ? "はい" : "いいえ"}</td>
                  <td className="text-right text-sm">{s.radius_m}m</td>
                  <td className="text-right">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
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
                  </td>
                </tr>
              ))}
              {!listQ.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    拠点がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <DeleteConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`拠点「${deleting?.name ?? ""}」を削除しますか？`}
        description="この拠点を参照している勤怠・報告がある場合は削除できません。"
        pending={deleteM.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
