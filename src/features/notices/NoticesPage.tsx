"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  boardPosts,
  notices,
  getStaffName,
  getSiteName,
  sites,
} from "@/lib/mockData";
import { useAuth } from "@/features/auth/useAuth";
import { isEmployeeUser, resolveStaffProfile, filterNoticesForEmployee, filterBoardForEmployee } from "@/lib/employeeScope";
import {
  Bell,
  Pin,
  MessageSquare,
  CheckCircle2,
  Users,
  User,
  Building2,
} from "lucide-react";

const targetIcons = {
  all: Users,
  department: Building2,
  individual: User,
};

const targetLabels = {
  all: "全員",
  department: "部門",
  individual: "個人",
};

export default function NoticesPage() {
  const { user } = useAuth();
  const staff = resolveStaffProfile(user);
  const employee = isEmployeeUser(user) && staff;
  const missingProfile = isEmployeeUser(user) && !staff;

  const [selectedSite, setSelectedSite] = useState<string>(() => {
    if (staff?.siteIds[0]) return staff.siteIds[0]!;
    return sites[0]!.id;
  });

  const siteOptions = useMemo(() => {
    if (employee && staff) {
      return sites.filter((s) => staff.siteIds.includes(s.id));
    }
    return sites;
  }, [employee, staff]);

  const { visibleNotices, boardForSite } = useMemo(() => {
    if (employee && staff) {
      const vn = filterNoticesForEmployee(staff);
      const atSite = filterBoardForEmployee(staff).filter((p) => p.siteId === selectedSite);
      atSite.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return { visibleNotices: vn, boardForSite: atSite };
    }
    const filtered = boardPosts.filter((p) => p.siteId === selectedSite);
    const sorted = [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    const nSorted = [...notices].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return { visibleNotices: nSorted, boardForSite: sorted };
  }, [employee, staff, selectedSite]);

  if (missingProfile) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        従業員プロフィールがアカウントに連携されていません。管理者に連絡してください。
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">連絡・掲示板</h1>
        <p className="text-sm text-muted-foreground -mt-0.5">
          {employee
            ? "あなたの子会社・配属現場の連絡（日付順）"
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
          {visibleNotices.map((n) => {
            const TargetIcon = targetIcons[n.targetType];
            const readRate = Math.round((n.readCount / n.totalTarget) * 100);
            return (
              <Card key={n.id} className="animate-fade-in transition-shadow hover:shadow-md">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                          <TargetIcon className="h-3 w-3" />
                          {targetLabels[n.targetType]}
                        </Badge>
                        {n.clientId && (
                          <Badge variant="secondary" className="text-[9px]">
                            子会社指定
                          </Badge>
                        )}
                        <time
                          className="text-[10px] text-muted-foreground"
                          dateTime={n.createdAt}
                        >
                          {new Date(n.createdAt).toLocaleString("ja-JP", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <h3 className="mb-1 text-sm font-medium leading-snug">{n.title}</h3>
                      <p className="line-clamp-3 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        発信者: {getStaffName(n.fromStaffId)}
                      </p>
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
                        {n.readCount}/{n.totalTarget}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {visibleNotices.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">表示する連絡はありません</p>
          )}
        </TabsContent>

        <TabsContent value="board" className="mt-3 space-y-3 sm:mt-4">
          <div className="flex flex-wrap gap-2">
            {siteOptions.map((site) => (
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

          {boardForSite.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground sm:py-12">
                この現場の掲示はありません
              </CardContent>
            </Card>
          ) : (
            boardForSite.map((post) => (
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
                        <span>{getSiteName(post.siteId)}</span>
                        <span>·</span>
                        <span>{getStaffName(post.authorId)}</span>
                        <time dateTime={post.createdAt}>
                          {new Date(post.createdAt).toLocaleString("ja-JP", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {employee && staff && siteOptions.length > 0 && (
            <p className="text-center text-[10px] text-muted-foreground">
              掲示は配属現場 {staff.siteIds.length} 箇所のうち、選択中の現場の投稿を表示しています
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
