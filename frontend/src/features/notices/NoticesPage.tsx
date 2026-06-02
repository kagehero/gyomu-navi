"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/useAuth";
import { useMySites } from "@/features/attendance/api";
import { useBoardPosts, useMarkNoticeRead, useNotices } from "@/features/notices/api";
import {
  Bell,
  Pin,
  MessageSquare,
  CheckCircle2,
  Users,
  User,
  Building2,
  Loader2,
} from "lucide-react";

const TARGET_ICONS = {
  all: Users,
  department: Building2,
  individual: User,
} as const;
const TARGET_LABELS = { all: "全員", department: "部門", individual: "個人" } as const;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "読み込みに失敗しました";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export default function NoticesPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";

  const noticesQ = useNotices();
  const sitesQ = useMySites();
  const markRead = useMarkNoticeRead();

  // Memoize derived arrays so dependent hooks don't re-fire on every render.
  const sites = useMemo(() => sitesQ.data?.items ?? [], [sitesQ.data?.items]);
  const [selectedSite, setSelectedSite] = useState<string>("");

  useEffect(() => {
    if (!selectedSite && sites[0]) setSelectedSite(sites[0].id);
  }, [sites, selectedSite]);

  const boardQ = useBoardPosts(selectedSite || undefined);

  const notices = noticesQ.data?.items ?? [];
  const boardPosts = useMemo(() => boardQ.data?.items ?? [], [boardQ.data?.items]);

  const sortedBoard = useMemo(() => {
    return [...boardPosts].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [boardPosts]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">連絡・掲示板</h1>
        <p className="text-sm text-muted-foreground -mt-0.5">
          {isEmployee
            ? "あなた宛 / 自部門 / 全体 の連絡と、配属現場の掲示"
            : "業務連絡・現場別掲示板"}
        </p>
      </div>

      <Tabs defaultValue="notices">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="notices" className="min-h-10 gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            業務連絡
          </TabsTrigger>
          <TabsTrigger value="board" className="min-h-10 gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            現場掲示
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notices" className="mt-3 space-y-3 sm:mt-4">
          {noticesQ.isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {noticesQ.isError && (
            <p className="text-center text-sm text-destructive">
              {errorMessage(noticesQ.error)}
            </p>
          )}
          {notices.map((n) => {
            const TargetIcon = TARGET_ICONS[n.target_type];
            const readRate =
              n.total_target > 0 ? Math.round((n.read_count / n.total_target) * 100) : 0;
            return (
              <Card
                key={n.id}
                className={`animate-fade-in transition-shadow hover:shadow-md ${
                  !n.is_read ? "border-primary/30 bg-primary/[0.02]" : ""
                }`}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                          <TargetIcon className="h-3 w-3" />
                          {TARGET_LABELS[n.target_type]}
                        </Badge>
                        {n.target_department_name && (
                          <Badge variant="secondary" className="text-[9px]">
                            {n.target_department_name}
                          </Badge>
                        )}
                        {n.client_name && (
                          <Badge variant="secondary" className="text-[9px]">
                            {n.client_name}
                          </Badge>
                        )}
                        {!n.is_read && (
                          <Badge className="text-[9px]">未読</Badge>
                        )}
                        <time className="text-[10px] text-muted-foreground" dateTime={n.created_at}>
                          {formatDateTime(n.created_at)}
                        </time>
                      </div>
                      <h3 className="mb-1 text-sm font-medium leading-snug">{n.title}</h3>
                      <p className="line-clamp-3 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        発信者: {n.from_display_name}
                      </p>
                      {!n.is_read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-7 text-xs"
                          onClick={() => markRead.mutate(n.id)}
                          disabled={markRead.isPending}
                        >
                          既読にする
                        </Button>
                      )}
                    </div>
                    <div className="shrink-0 text-center">
                      <div className="flex items-center gap-1 text-xs">
                        <CheckCircle2
                          className={`h-3.5 w-3.5 ${
                            readRate === 100 ? "text-success" : "text-muted-foreground"
                          }`}
                        />
                        <span className="font-medium">{readRate}%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {n.read_count}/{n.total_target}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!noticesQ.isLoading && notices.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">表示する連絡はありません</p>
          )}
        </TabsContent>

        <TabsContent value="board" className="mt-3 space-y-3 sm:mt-4">
          <div className="flex flex-wrap gap-2">
            {sites.map((site) => (
              <Button
                key={site.id}
                variant={selectedSite === site.id ? "default" : "outline"}
                size="sm"
                className="min-h-9 text-xs"
                onClick={() => setSelectedSite(site.id)}
              >
                {site.name}
              </Button>
            ))}
          </div>

          {boardQ.isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {boardQ.isError && (
            <p className="text-center text-sm text-destructive">
              {errorMessage(boardQ.error)}
            </p>
          )}
          {!boardQ.isLoading && sortedBoard.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground sm:py-12">
                この現場の掲示はありません
              </CardContent>
            </Card>
          ) : (
            sortedBoard.map((post) => (
              <Card
                key={post.id}
                className={`animate-fade-in ${
                  post.pinned ? "border-primary/30 bg-primary/[0.02]" : ""
                }`}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-2">
                    {post.pinned && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium leading-snug">{post.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{post.body}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{post.site_name}</span>
                        <span>·</span>
                        <span>{post.author_display_name}</span>
                        <time dateTime={post.created_at}>{formatDateTime(post.created_at)}</time>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
