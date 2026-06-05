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
import { Pencil, Plus, Trash2, Loader2, Network } from "lucide-react";
import { DataList } from "@/components/ui/data-list";
import { toast } from "sonner";
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useUpdateDepartment,
  type Department,
} from "@/features/master/api";
import { DeleteConfirmDialog } from "@/features/master/DeleteConfirmDialog";

const schema = z.object({
  name: z.string().trim().min(1, "名称を入力してください").max(100),
});
type FormValues = z.infer<typeof schema>;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "操作に失敗しました";
}

function DepartmentFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Department | null;
}) {
  const createM = useCreateDepartment();
  const updateM = useUpdateDepartment();
  const isEdit = initial !== null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: { name: initial?.name ?? "" },
  });

  const submit = form.handleSubmit(async (v) => {
    try {
      if (isEdit) {
        await updateM.mutateAsync({ id: initial!.id, name: v.name });
        toast.success("部門を更新しました");
      } else {
        await createM.mutateAsync({ name: v.name });
        toast.success("部門を作成しました");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const pending = createM.isPending || updateM.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "部門を編集" : "部門を新規作成"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">名称</Label>
            <Input className="h-10" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
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

export default function MasterDepartmentsCrud() {
  const listQ = useDepartments();
  const deleteM = useDeleteDepartment();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (d: Department) => {
    setEditing(d);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteM.mutateAsync(deleting.id);
      toast.success("部門を削除しました");
      setDeleting(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const items = listQ.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">社内部門一覧 ({items.length}件)</CardTitle>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8" onClick={openCreate}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              新規作成
            </Button>
          </DialogTrigger>
          <DepartmentFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            initial={editing}
          />
        </Dialog>
      </CardHeader>
      <CardContent className="p-3 md:p-0">
        <DataList
          items={items}
          isLoading={listQ.isLoading}
          error={listQ.isError ? listQ.error : undefined}
          getKey={(d) => d.id}
          empty={{ icon: Network, title: "部門がありません" }}
          renderCard={(d) => (
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3">
              <p className="min-w-0 truncate text-sm font-semibold">{d.name}</p>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => openEdit(d)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => setDeleting(d)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          table={{
            minWidth: 320,
            head: (
              <tr>
                <th>名称</th>
                <th className="w-24 text-right">操作</th>
              </tr>
            ),
            renderRow: (d) => (
              <tr>
                <td className="text-sm font-medium">{d.name}</td>
                <td className="text-right">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(d)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleting(d)}>
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
        title={`部門「${deleting?.name ?? ""}」を削除しますか？`}
        description="この部門を参照しているスタッフがいる場合は削除できません。"
        pending={deleteM.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
