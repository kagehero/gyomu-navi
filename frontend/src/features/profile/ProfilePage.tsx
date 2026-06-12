"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPatch } from "@/lib/api";
import { useAuth } from "@/features/auth/useAuth";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

const schema = z
  .object({
    current_password: z.string().min(1, "現在のパスワードを入力してください"),
    new_password: z.string().trim().min(8, "新しいパスワードは8文字以上にしてください").max(200),
    new_password_confirm: z.string().min(1, "確認用パスワードを入力してください"),
  })
  .refine((v) => v.new_password === v.new_password_confirm, {
    message: "パスワードが一致しません",
    path: ["new_password_confirm"],
  });

type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      current_password: "",
      new_password: "",
      new_password_confirm: "",
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      await apiPatch<{ ok: true }>("/api/me/password", {
        current_password: data.current_password,
        new_password: data.new_password,
      });
      toast.success("パスワードを変更しました");
      form.reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "パスワードの変更に失敗しました");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <PageContainer width="narrow">
      <PageHeader title="プロフィール" description="アカウント情報の確認とパスワードの変更" />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">アカウント情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">氏名</Label>
            <Input className="h-10" value={user?.displayName ?? ""} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">メールアドレス</Label>
            <Input className="h-10" value={user?.email ?? ""} readOnly disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            パスワード変更
          </CardTitle>
          <CardDescription>
            現在のパスワードを確認のうえ、新しいパスワード（8文字以上）を設定してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current_password" className="text-xs">現在のパスワード</Label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                disabled={submitting}
                className="h-10"
                {...form.register("current_password")}
              />
              {form.formState.errors.current_password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.current_password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new_password" className="text-xs">新しいパスワード</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                disabled={submitting}
                className="h-10"
                {...form.register("new_password")}
              />
              {form.formState.errors.new_password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.new_password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new_password_confirm" className="text-xs">新しいパスワード（確認）</Label>
              <Input
                id="new_password_confirm"
                type="password"
                autoComplete="new-password"
                disabled={submitting}
                className="h-10"
                {...form.register("new_password_confirm")}
              />
              {form.formState.errors.new_password_confirm && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.new_password_confirm.message}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    変更中
                  </>
                ) : (
                  "パスワードを変更"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
