"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Pencil, Trash2, Loader2, X, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DataList } from "@/components/ui/data-list";
import { SearchInput } from "@/components/ui/search-input";
import { useTextSearch } from "@/hooks/use-text-search";
import {
  useDeleteStaff,
  useDepartments,
  useStaffs,
  useUpdateStaff,
  useBulkApproveStaff,
  useClients,
  useBusinessLines,
  type ClientCompany,
  type Staff,
} from "@/features/master/api";
import { DeleteConfirmDialog } from "@/features/master/DeleteConfirmDialog";

/** business_line_id → selected client ids under that department */
type BlClientAssignments = Record<string, string[]>;

const schema = z.object({
  name: z.string().trim().min(1, "氏名を入力してください").max(100),
  department_id: z.string().uuid("社内部門を選んでください"),
  hourly_rate: z.coerce.number().int().min(0).max(1_000_000),
  client_ids: z.array(z.string().uuid()).min(1, "担当顧客を1件以上選択してください"),
  business_line_ids: z.array(z.string().uuid()).min(1, "担当部門を1件以上選択してください"),
});
type FormValues = z.infer<typeof schema>;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "操作に失敗しました";
}

function isPending(staff: Staff): boolean {
  return !staff.login_approved_at;
}

/**
 * A pending staff can be auto-approved in bulk only when it already meets the
 * same prerequisites the backend enforces: a department plus ≥1 client and ≥1
 * business line. Others must be approved individually from the edit dialog
 * (where those assignments get set). Mirrors the server's bulkApprove guard.
 */
function isBulkApprovable(staff: Staff): boolean {
  return (
    isPending(staff) &&
    !!staff.department_id &&
    (staff.client_ids?.length ?? 0) >= 1 &&
    (staff.business_line_ids?.length ?? 0) >= 1
  );
}

function buildAssignmentsFromStaff(
  staff: Staff,
  clients: ClientCompany[],
): BlClientAssignments {
  const map: BlClientAssignments = {};
  for (const blId of staff.business_line_ids ?? []) {
    map[blId] = (staff.client_ids ?? []).filter((clientId) => {
      const client = clients.find((c) => c.id === clientId);
      return client?.business_line_ids?.includes(blId);
    });
  }
  for (const clientId of staff.client_ids ?? []) {
    const client = clients.find((c) => c.id === clientId);
    for (const blId of client?.business_line_ids ?? []) {
      if (!map[blId]?.includes(clientId)) {
        map[blId] = [...(map[blId] ?? []), clientId];
      }
    }
  }
  return map;
}

function flattenAssignments(assignments: BlClientAssignments): {
  business_line_ids: string[];
  client_ids: string[];
} {
  const business_line_ids = Object.entries(assignments)
    .filter(([, ids]) => ids.length > 0)
    .map(([blId]) => blId);
  const client_ids = [...new Set(Object.values(assignments).flat())];
  return { business_line_ids, client_ids };
}

function DepartmentClientAssignEditor({
  businessLines,
  clients,
  assignments,
  onChange,
  errors,
}: {
  businessLines: { id: string; name: string }[];
  clients: ClientCompany[];
  assignments: BlClientAssignments;
  onChange: (next: BlClientAssignments) => void;
  errors?: {
    business_line_ids?: { message?: string };
    client_ids?: { message?: string };
  };
}) {
  const [activeBlId, setActiveBlId] = useState("");

  const activeBlClients = useMemo(() => {
    if (!activeBlId) return [];
    return clients.filter((c) => (c.business_line_ids ?? []).includes(activeBlId));
  }, [activeBlId, clients]);

  const selectedForActiveBl = new Set(assignments[activeBlId] ?? []);

  const summary = useMemo(() => {
    return businessLines
      .map((bl) => ({
        bl,
        clientIds: assignments[bl.id] ?? [],
      }))
      .filter((row) => row.clientIds.length > 0);
  }, [assignments, businessLines]);

  const toggleClient = (clientId: string) => {
    if (!activeBlId) return;
    const current = new Set(assignments[activeBlId] ?? []);
    if (current.has(clientId)) current.delete(clientId);
    else current.add(clientId);
    onChange({ ...assignments, [activeBlId]: [...current] });
  };

  const removeClient = (blId: string, clientId: string) => {
    const next = { ...assignments, [blId]: (assignments[blId] ?? []).filter((id) => id !== clientId) };
    if (next[blId]?.length === 0) delete next[blId];
    onChange(next);
  };

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">担当部署（報告用）</Label>
        <p className="text-[10px] text-muted-foreground">
          部署を選んでから顧客を選択します。複数の部署・顧客の組み合わせを登録できます。
        </p>
        <Select
          value={activeBlId || undefined}
          onValueChange={setActiveBlId}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="部署を選択" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="z-[100]">
            {businessLines.map((bl) => (
              <SelectItem key={bl.id} value={bl.id}>
                {bl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeBlId && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            顧客（{businessLines.find((b) => b.id === activeBlId)?.name}）
          </Label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
            {activeBlClients.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40"
              >
                <Checkbox
                  checked={selectedForActiveBl.has(c.id)}
                  onCheckedChange={() => toggleClient(c.id)}
                />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
            {activeBlClients.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                この部署に紐づく顧客がありません
              </p>
            )}
          </div>
        </div>
      )}

      {summary.length > 0 && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <Label className="text-xs">選択中の担当</Label>
          {summary.map(({ bl, clientIds }) => (
            <div key={bl.id} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{bl.name}</p>
              <div className="flex flex-wrap gap-1">
                {clientIds.map((clientId) => (
                  <Badge key={`${bl.id}-${clientId}`} variant="secondary" className="gap-1 pr-1">
                    {clientName(clientId)}
                    <button
                      type="button"
                      className="rounded-sm hover:bg-muted"
                      onClick={() => removeClient(bl.id, clientId)}
                      aria-label={`${clientName(clientId)}を解除`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(errors?.business_line_ids || errors?.client_ids) && (
        <p className="text-xs text-destructive">
          {errors.business_line_ids?.message ?? errors.client_ids?.message}
        </p>
      )}
    </div>
  );
}

function StaffFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Staff;
}) {
  const deptsQ = useDepartments();
  const clientsQ = useClients();
  const blQ = useBusinessLines();
  const updateM = useUpdateStaff();
  const pending = isPending(initial);

  const allClients = clientsQ.data?.items ?? [];
  const businessLines = blQ.data?.items ?? [];

  const [assignments, setAssignments] = useState<BlClientAssignments>(() =>
    buildAssignmentsFromStaff(initial, allClients),
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: initial.name,
      department_id: initial.department_id ?? "",
      hourly_rate: initial.hourly_rate ?? 1200,
      client_ids: initial.client_ids ?? [],
      business_line_ids: initial.business_line_ids ?? [],
    },
  });

  useEffect(() => {
    if (!clientsQ.isSuccess) return;
    setAssignments(buildAssignmentsFromStaff(initial, clientsQ.data?.items ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- watch the staff identity fields only; whole-object dep would re-fire on every parent render
  }, [initial.id, initial.client_ids, initial.business_line_ids, clientsQ.isSuccess, clientsQ.data]);

  const syncAssignmentsToForm = (next: BlClientAssignments) => {
    setAssignments(next);
    const flat = flattenAssignments(next);
    form.setValue("business_line_ids", flat.business_line_ids, { shouldValidate: true });
    form.setValue("client_ids", flat.client_ids, { shouldValidate: true });
  };

  const submitUpdate = form.handleSubmit(async (v) => {
    try {
      await updateM.mutateAsync({
        id: initial.id,
        name: v.name,
        department_id: v.department_id,
        hourly_rate: v.hourly_rate,
        client_ids: v.client_ids,
        business_line_ids: v.business_line_ids,
      });
      toast.success("スタッフを更新しました");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const submitApprove = form.handleSubmit(async (v) => {
    try {
      await updateM.mutateAsync({
        id: initial.id,
        name: v.name,
        department_id: v.department_id,
        hourly_rate: v.hourly_rate,
        client_ids: v.client_ids,
        business_line_ids: v.business_line_ids,
        approve: true,
      });
      toast.success("ログインを承認しました。従業員はログインできるようになりました。");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const submitting = updateM.isPending;
  const depts = deptsQ.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pending ? "従業員登録の承認" : "スタッフを編集"}</DialogTitle>
        </DialogHeader>
        {pending && (
          <p className="text-xs text-muted-foreground">
            従業員が登録したログイン情報を確認し、社内部門・担当部門・担当顧客を設定して承認してください。
          </p>
        )}
        <form className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">氏名</Label>
            <Input className="h-10" {...form.register("name")} readOnly={pending} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">ログインメール</Label>
            <Input className="h-10" value={initial.login_email ?? ""} readOnly disabled />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">社内部門</Label>
              <Select
                value={form.watch("department_id") || undefined}
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
              <Input type="number" className="h-10" {...form.register("hourly_rate")} />
            </div>
          </div>

          <DepartmentClientAssignEditor
            businessLines={businessLines}
            clients={allClients}
            assignments={assignments}
            onChange={syncAssignmentsToForm}
            errors={{
              business_line_ids: form.formState.errors.business_line_ids,
              client_ids: form.formState.errors.client_ids,
            }}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            {pending ? (
              <Button type="button" disabled={submitting} onClick={submitApprove}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                承認する
              </Button>
            ) : (
              <Button type="button" disabled={submitting} onClick={submitUpdate}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                更新
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MasterStaffsCrud() {
  const listQ = useStaffs();
  const deleteM = useDeleteStaff();
  const bulkApproveM = useBulkApproveStaff();

  const [editing, setEditing] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState<Staff | null>(null);

  const openEdit = (s: Staff) => setEditing(s);
  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteM.mutateAsync(deleting.id);
      toast.success("登録を削除しました");
      setDeleting(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const items = useMemo(() => listQ.data?.items ?? [], [listQ.data?.items]);
  const pendingCount = items.filter(isPending).length;
  const bulkApprovable = useMemo(() => items.filter(isBulkApprovable), [items]);

  const handleBulkApprove = async () => {
    if (bulkApprovable.length === 0) return;
    try {
      const res = await bulkApproveM.mutateAsync(bulkApprovable.map((s) => s.id));
      if (res.approved.length > 0) {
        toast.success(`${res.approved.length}名のログインを承認しました`);
      }
      if (res.skipped.length > 0) {
        toast.warning(`${res.skipped.length}名は設定不足のためスキップしました`);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const { query, setQuery, results } = useTextSearch(items, (s) => [
    s.name,
    s.login_email,
    s.department_name,
  ]);

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">スタッフ一覧 ({items.length}名)</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            従業員は /register からログイン情報を登録します。承認待ち: {pendingCount}件
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {bulkApprovable.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 border-amber-400 text-amber-700"
              onClick={handleBulkApprove}
              disabled={bulkApproveM.isPending}
            >
              {bulkApproveM.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 h-4 w-4" />
              )}
              一括承認（{bulkApprovable.length}名）
            </Button>
          )}
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="氏名・メール・部門で検索"
            className="w-full sm:max-w-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-0">
        <DataList
          items={results}
          isLoading={listQ.isLoading}
          error={listQ.isError ? listQ.error : undefined}
          getKey={(s) => s.id}
          empty={
            query
              ? {
                  icon: Users,
                  title: "該当するスタッフがいません",
                  description: `「${query}」に一致するスタッフは見つかりませんでした`,
                }
              : { icon: Users, title: "スタッフがいません", description: "従業員は /register から登録します" }
          }
          renderCard={(s) => (
            <div
              className={cn(
                "rounded-xl border p-3",
                isPending(s) ? "border-amber-300 bg-amber-50/60" : "bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.login_email ?? "—"}</p>
                </div>
                {isPending(s) ? (
                  <Badge variant="outline" className="shrink-0 border-amber-500 text-amber-700">
                    承認待ち
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">利用可</Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>部門: {s.department_name ?? "未設定"}</span>
                <span>{s.business_line_ids?.length ?? 0}部門 / {s.client_ids?.length ?? 0}顧客</span>
                <span>時給 ¥{s.hourly_rate.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex justify-end gap-1 border-t pt-2">
                <Button size="sm" variant="ghost" className="h-9" onClick={() => openEdit(s)}>
                  {isPending(s) ? (
                    <><CheckCircle2 className="mr-1 h-4 w-4 text-primary" />承認</>
                  ) : (
                    <><Pencil className="mr-1 h-4 w-4" />編集</>
                  )}
                </Button>
                <Button size="sm" variant="ghost" className="h-9 text-destructive" onClick={() => setDeleting(s)}>
                  <Trash2 className="mr-1 h-4 w-4" />削除
                </Button>
              </div>
            </div>
          )}
          table={{
            minWidth: 760,
            head: (
              <tr>
                <th>名前</th>
                <th>状態</th>
                <th>ログインメール</th>
                <th>社内部門</th>
                <th className="text-right">担当</th>
                <th className="text-right">時給</th>
                <th className="w-24 text-right">操作</th>
              </tr>
            ),
            renderRow: (s) => (
              <tr className={isPending(s) ? "bg-amber-50/60 hover:bg-amber-50" : ""}>
                <td className="text-sm font-medium">{s.name}</td>
                <td>
                  {isPending(s) ? (
                    <Badge variant="outline" className="border-amber-500 text-amber-700">承認待ち</Badge>
                  ) : (
                    <Badge variant="secondary">利用可</Badge>
                  )}
                </td>
                <td className="text-sm text-muted-foreground">{s.login_email ?? "—"}</td>
                <td className="text-sm">{s.department_name ?? "未設定"}</td>
                <td className="text-right text-sm text-muted-foreground">
                  {s.business_line_ids?.length ?? 0}部門 / {s.client_ids?.length ?? 0}顧客
                </td>
                <td className="text-right text-sm">¥{s.hourly_rate.toLocaleString()}</td>
                <td className="text-right">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                    {isPending(s) ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Pencil className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleting(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ),
          }}
        />
      </CardContent>

      {editing && (
        <StaffFormDialog
          open={editing !== null}
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing}
        />
      )}

      <DeleteConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`「${deleting?.name ?? ""}」の登録を削除しますか？`}
        description={
          isPending(deleting ?? ({} as Staff))
            ? "未承認のログイン登録を取り消します。"
            : "このスタッフの勤怠・報告がある場合は削除できません。"
        }
        pending={deleteM.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
