"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, MapPin, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "gyomu_navi.onboarded_v1";

/**
 * One-time getting-started banner shown to employees on their first visit.
 * Dismissal is persisted to localStorage. Safe to render unconditionally —
 * returns null if already dismissed or running on the server.
 */
export function OnboardingBanner({ role }: { role: "employee" | "admin" | "manager" | undefined }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY) === "1";
      if (!seen) setVisible(true);
    } catch {
      /* storage disabled — silently skip */
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* non-fatal */
    }
  };

  if (!visible || !role) return null;

  const tips = role === "employee" ? EMPLOYEE_TIPS : ADMIN_TIPS;

  return (
    <Card className="relative border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="p-4">
        <button
          type="button"
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-background/60"
          onClick={dismiss}
          aria-label="案内を閉じる"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold">業務管理システムへようこそ</p>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          まずは以下の操作からお試しください。
        </p>
        <ul className="space-y-2">
          {tips.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.title} className="flex items-start gap-2 text-xs">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <Link href={t.href} className="font-medium text-foreground hover:underline">
                    {t.title}
                  </Link>
                  <p className="text-muted-foreground">{t.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={dismiss}>
            閉じる
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const EMPLOYEE_TIPS = [
  {
    icon: MapPin,
    href: "/attendance",
    title: "現場に到着したら、勤怠ページから出勤打刻",
    body: "GPS で位置を取得して打刻します。退勤時も同じ画面から。",
  },
  {
    icon: ClipboardList,
    href: "/reports",
    title: "作業が終わったら、業務報告を入力",
    body: "顧客・拠点・台数を選び、必要であれば現場写真を添付できます。",
  },
] as const;

const ADMIN_TIPS = [
  {
    icon: ClipboardList,
    href: "/reports",
    title: "業務報告一覧で売上を即時集計",
    body: "日付・顧客・スタッフでフィルタし、CSV 出力も可能です。",
  },
  {
    icon: MapPin,
    href: "/master",
    title: "マスタ管理で顧客・現場・業務内容を登録",
    body: "従業員の入力候補は、このマスタから生成されます。",
  },
] as const;
