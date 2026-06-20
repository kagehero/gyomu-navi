"use client";

import { useMemo, useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { EmployeeBottomNav } from "@/components/layout/EmployeeBottomNav";
import { toast } from "sonner";

const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/reports", title: "業務報告" },
  { prefix: "/attendance", title: "勤怠" },
  { prefix: "/notices", title: "連絡・掲示板" },
  { prefix: "/master", title: "マスタ" },
];

export function EmployeeAppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      toast.success("ログアウトしました");
      router.replace("/login");
    } catch {
      toast.error("ログアウトに失敗しました");
      setLoggingOut(false);
    }
  };

  const title = useMemo(() => {
    const p = pathname ?? "/";
    if (p === "/") return "ダッシュボード";
    const hit = TITLES.find((t) => p.startsWith(t.prefix));
    return hit?.title ?? "業務管理";
  }, [pathname]);

  return (
    <div className="flex min-h-dvh w-full justify-center bg-muted/25">
      <div className="employee-mobile relative flex w-full max-w-md min-h-dvh flex-col overflow-hidden border-x border-border/60 bg-background shadow-xl sm:my-2 sm:min-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1rem)] sm:rounded-2xl sm:border sm:shadow-2xl">
        <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-between border-b bg-card/95 px-3 backdrop-blur sm:rounded-t-2xl">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo */}
              <img
                src="/icon.png"
                alt="業務管理システム ロゴ"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{title}</p>
              <Link
                href="/profile"
                className="block truncate text-[10px] text-muted-foreground hover:text-foreground hover:underline"
              >
                {(user?.displayName?.trim() || user?.email?.split("@")[0]) ?? "—"} · 従業員
              </Link>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="ログアウト"
            title="ログアウト"
            disabled={loggingOut}
            onClick={handleLogout}
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 pb-24">
          {children}
        </div>
        <EmployeeBottomNav />
      </div>
    </div>
  );
}
