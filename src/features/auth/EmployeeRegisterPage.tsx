"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/features/auth/useAuth";

const schema = z
  .object({
    name: z.string().trim().min(1, "氏名を入力してください").max(100),
    email: z.string().min(1, "メールアドレスを入力してください").email("形式が正しくありません"),
    password: z.string().min(8, "パスワードは8文字以上にしてください"),
    password_confirm: z.string().min(1, "確認用パスワードを入力してください"),
  })
  .refine((v) => v.password === v.password_confirm, {
    message: "パスワードが一致しません",
    path: ["password_confirm"],
  });

type FormValues = z.infer<typeof schema>;

export default function EmployeeRegisterPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      password_confirm: "",
    },
  });

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  if (!isLoading && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string }>("/api/auth/register/employee", {
        name: data.name,
        email: data.email,
        password: data.password,
      });
      toast.success(res.message ?? "登録を受け付けました");
      router.replace("/login?registered=1");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">従業員アカウント登録</h1>
          <p className="text-sm text-muted-foreground">
            ログイン情報を登録後、管理者の承認をお待ちください
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">新規登録</CardTitle>
            <CardDescription>
              氏名・メールアドレス・パスワードを設定してください。管理者が担当部署・顧客を設定して承認するとログインできます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">氏名</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  disabled={submitting}
                  className="h-10"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  disabled={submitting}
                  className="h-10"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  disabled={submitting}
                  className="h-10"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password_confirm">パスワード（確認）</Label>
                <Input
                  id="password_confirm"
                  type="password"
                  autoComplete="new-password"
                  disabled={submitting}
                  className="h-10"
                  {...form.register("password_confirm")}
                />
                {form.formState.errors.password_confirm && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.password_confirm.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登録中
                  </>
                ) : (
                  "ログイン情報を登録"
                )}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              承認済みの方は{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                ログイン
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
