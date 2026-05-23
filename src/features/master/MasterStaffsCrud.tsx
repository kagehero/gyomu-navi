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
  useCreateStaff,
  useDeleteStaff,
  useDepartments,
  useSites,
  useStaffs,
  useUpdateStaff,
  type Staff,
} from "@/features/master/api";
import { DeleteConfirmDialog } from "@/features/master/DeleteConfirmDialog";

const schema = z.object({
  name: z.string().trim().min(1, "氏名を入力してください").max(100),
  department_id: z.string().uuid("部門を選んでください"),
  hourly_rate: z.coerce.number().int().min(0).max(1_000_000),
  site_ids: z.array(z.string().uuid()),
});
type FormValues = z.infer<typeof schema>;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "操作に失敗しました";
}

function StaffFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Staff | null;
}) {
  const deptsQ = useDepartments();
  const sitesQ = useSites();
  const createM = useCreateStaff();
  const updateM = useUpdateStaff();
  const isEdit = initial !== null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: initial?.name ?? "",
      department_id: initial?.department_id ?? "",
      hourly_rate: initial?.hourly_rate ?? 1200,
      site_ids: initial?.site_ids ?? [],
    },
  });

  const submit = form.handleSubmit(async (v) => {
    try {
      if (isEdit) {
        await updateM.mutateAsync({ id: initial!.id, ...v });
        toast.success("スタッフを更新しました");
      } else {
        await createM.mutateAsync(v);
        toast.success("スタッフを作成しました");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const pending = createM.isPending || updateM.isPending;
  const depts = deptsQ.data?.items ?? [];
  const sites = sitesQ.data?.items ?? [];
  const selectedSiteIds = new Set(form.watch("site_ids"));

  const toggleSite = (siteId: string) => {
    const current = new Set(form.getValues("site_ids"));
    if (current.has(siteId)) current.delete(siteId);
    else current.add(siteId);
    form.setValue("site_ids", [...current]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "スタッフを編集" : "スタッフを新規作成"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">氏名</Label>
            <Input className="h-10" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">部門</Label>
              <Select
                value={form.watch("department_id")}
                onValueChange={(v) =>
                  form.setValue("department_id", v, { shouldValidate: true })
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="部門を選択" />
                </SelectTrigger>
                <SelectContent>
                  {depts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.department_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.department_id.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">時給 (円)</Label>
              <Input
                type="number"
                className="h-10"
                {...form.register("hourly_rate")}
              />
              {form.formState.errors.hourly_rate && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.hourly_rate.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              配属現場 ({selectedSiteIds.size}件選択中)
            </Label>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {sites.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selectedSiteIds.has(s.id)}
                    onCheckedChange={() => toggleSite(s.id)}
                  />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-[10px] text-muted-foreground">{s.client_name}</span>
                </label>
              ))}
              {sites.length === 0 && (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  選択できる現場がありません
                </p>
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

export default function MasterStaffsCrud() {
  const listQ = useStaffs();
  const deleteM = useDeleteStaff();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState<Staff | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Staff) => {
    setEditing(s);
    setFormOpen(true);
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteM.mutateAsync(deleting.id);
      toast.success("スタッフを削除しました");
      setDeleting(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const items = listQ.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">スタッフ一覧 ({items.length}名)</CardTitle>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8" onClick={openCreate}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              新規作成
            </Button>
          </DialogTrigger>
          <StaffFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} />
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>名前</th>
                <th>部門</th>
                <th className="text-right">配属</th>
                <th className="text-right">時給</th>
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
                  <td className="text-sm">{s.department_name}</td>
                  <td className="text-right text-sm text-muted-foreground">
                    {s.site_ids.length}件
                  </td>
                  <td className="text-right text-sm">¥{s.hourly_rate.toLocaleString()}</td>
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
                    スタッフがいません
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
        title={`スタッフ「${deleting?.name ?? ""}」を削除しますか？`}
        description="このスタッフの勤怠・報告がある場合は削除できません。配属は自動で解除されます。"
        pending={deleteM.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
