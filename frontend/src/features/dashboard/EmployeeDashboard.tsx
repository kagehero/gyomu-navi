"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  MapPin,
  Pencil,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAttendanceToday } from "@/features/attendance/api";
import { useReports } from "@/features/reports/api";
import { useAuth } from "@/features/auth/useAuth";
import { useNotices } from "@/features/notices/api";
import { todayJST, formatJPDate, formatJPTime } from "@/lib/dates";
import { OnboardingBanner } from "./OnboardingBanner";

type ActionTone = "todo" | "done" | "warn";

/**
 * Tap-target action card for the employee home screen. Each card represents
 * a single decision: "you still need to do X" or "you've done X — view it".
 */
function ActionCard({
  href,
  tone,
  icon: Icon,
  title,
  subtitle,
  cta,
}: {
  href: string;
  tone: ActionTone;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  cta: string;
}) {
  const styles = {
    todo: "border-primary/40 bg-primary/5 hover:bg-primary/10",
    done: "border-success/30 bg-success/5 hover:bg-success/10",
    warn: "border-warning/40 bg-warning/5 hover:bg-warning/10",
  } as const;
  const iconStyles = {
    todo: "bg-primary/15 text-primary",
    done: "bg-success/15 text-success",
    warn: "bg-warning/15 text-warning",
  } as const;
  return (
    <Link href={href} className="block">
      <Card className={`transition-shadow hover:shadow-md ${styles[tone]}`}>
        <CardContent className="flex items-center gap-3 p-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconStyles[tone]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            {cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const today = todayJST();

  const todayAttQ = useAttendanceToday();
  const todayReportsQ = useReports({ date: today });
  const noticesQ = useNotices();

  const att = todayAttQ.data?.item ?? null;
  const myReports = useMemo(() => {
    const items = todayReportsQ.data?.items ?? [];
    if (!user) return items;
    return items.filter((r) => r.staff_id === user.id);
  }, [todayReportsQ.data?.items, user]);
  const myReportCount = myReports.length;

  const unreadCount = useMemo(
    () => (noticesQ.data?.items ?? []).filter((n) => !n.is_read).length,
    [noticesQ.data?.items],
  );

  const loading = todayAttQ.isLoading || todayReportsQ.isLoading;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          こんにちは、{user?.displayName ?? "—"}さん
        </h1>
        <p className="text-sm text-muted-foreground">{formatJPDate(today)} — 本日のタスク</p>
      </div>

      <OnboardingBanner role="employee" />

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {att ? (
            att.status === "done" ? (
              <ActionCard
                href="/attendance"
                tone="done"
                icon={CheckCircle2}
                title="本日の勤務は終了しています"
                subtitle={`出勤 ${formatJPTime(att.punch_in_at)} → 退勤 ${formatJPTime(att.punch_out_at)} / ${att.site_name ?? "—"}`}
                cta="確認"
              />
            ) : (
              <ActionCard
                href="/attendance"
                tone="todo"
                icon={Clock}
                title="勤務中です — 退勤打刻を忘れずに"
                subtitle={`${formatJPTime(att.punch_in_at)} 出勤 / ${att.site_name ?? "—"}`}
                cta="退勤"
              />
            )
          ) : (
            <ActionCard
              href="/attendance"
              tone="warn"
              icon={MapPin}
              title="本日の出勤打刻がまだです"
              subtitle="現場に着いたら GPS で打刻してください"
              cta="打刻"
            />
          )}

          {myReportCount === 0 ? (
            <ActionCard
              href="/reports"
              tone="warn"
              icon={ClipboardList}
              title="本日の業務報告がまだ未提出です"
              subtitle="作業した分の数量・画像を登録してください"
              cta="入力"
            />
          ) : (
            <ActionCard
              href="/reports"
              tone="done"
              icon={Pencil}
              title={`本日 ${myReportCount} 件報告済み`}
              subtitle="追加・履歴の確認はこちら"
              cta="開く"
            />
          )}

          {unreadCount > 0 && (
            <ActionCard
              href="/notices"
              tone="todo"
              icon={Bell}
              title={`未読の連絡が ${unreadCount} 件あります`}
              subtitle="業務連絡・現場掲示を確認してください"
              cta="確認"
            />
          )}
        </div>
      )}

      <div className="pt-1">
        <Button variant="ghost" size="sm" className="w-full justify-center text-xs text-muted-foreground" asChild>
          <Link href="/notices">すべての連絡・掲示板を見る</Link>
        </Button>
      </div>
    </div>
  );
}
