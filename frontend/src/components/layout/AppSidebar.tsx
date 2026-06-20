"use client";

import {
  LayoutDashboard,
  ClipboardList,
  Clock,
  MessageSquare,
  Building2,
  LogOut,
  BarChart3,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "@/components/layout/NavLink";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useReleaseMode } from "@/components/layout/ReleaseModeContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  roles?: readonly ("admin" | "manager")[];
};

const mainItems: NavItem[] = [
  { title: "ダッシュボード", url: "/", icon: LayoutDashboard },
  { title: "業務報告", url: "/reports", icon: ClipboardList },
  { title: "売上集計", url: "/analytics", icon: BarChart3, roles: ["admin", "manager"] },
  { title: "勤怠管理", url: "/attendance", icon: Clock },
  { title: "連絡・掲示板", url: "/notices", icon: MessageSquare },
];

const adminItems = [
  { title: "マスタ管理", url: "/master", icon: Building2 },
];

const ROLE_LABELS = {
  admin: "管理者",
  manager: "マネージャー",
  employee: "従業員",
} as const;

/** Best-effort display name: explicit name → email local-part → "ユーザー". */
function resolveName(
  user: { displayName?: string | null; email?: string | null } | null,
): string {
  if (!user) return "ユーザー";
  const name = user.displayName?.trim();
  if (name) return name;
  const local = user.email?.split("@")[0];
  return local || "ユーザー";
}

function displayInitial(name: string) {
  const t = name.trim();
  if (!t) return "?";
  return t[0]!.toUpperCase();
}

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, logout } = useAuth();
  const { dashboardOnly } = useReleaseMode();
  const router = useRouter();
  const collapsed = state === "collapsed";
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

  const mainNav = dashboardOnly
    ? mainItems.filter((i) => i.url === "/")
    : mainItems.filter(
        (i) => !i.roles || (user?.role != null && i.roles.includes(user.role as "admin" | "manager")),
      );
  const showAdminItems = user?.role === "admin" && !dashboardOnly;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-sidebar-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo */}
            <img
              src="/icon.png"
              alt="業務管理システム ロゴ"
              className="h-full w-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">業務管理システム</span>
              <span className="text-[10px] text-sidebar-foreground/60">WorkFlow Pro</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
            メニュー
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent font-medium text-sidebar-primary"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdminItems && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
              管理
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent font-medium text-sidebar-primary"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="space-y-2 border-t border-sidebar-border px-2 py-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/profile"
              title={`${resolveName(user)}（プロフィール）`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary ring-1 ring-sidebar-border transition-colors hover:bg-sidebar-primary/30"
            >
              {displayInitial(resolveName(user))}
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive"
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
          </div>
        ) : (
          <>
            <Link
              href="/profile"
              title="プロフィール"
              className="group flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-sidebar-accent"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-sm font-semibold text-sidebar-primary ring-1 ring-sidebar-border">
                {displayInitial(resolveName(user))}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 text-xs font-medium text-sidebar-foreground">
                  <span className="truncate">{resolveName(user)}</span>
                  {user && (
                    <span className="shrink-0 rounded bg-sidebar-primary/15 px-1.5 py-0.5 text-[9px] font-medium leading-none text-sidebar-primary">
                      {ROLE_LABELS[user.role]}
                    </span>
                  )}
                </span>
                <span className="truncate text-[10px] text-sidebar-foreground/50">
                  {user?.email}
                </span>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/30 transition-colors group-hover:text-sidebar-foreground/60" />
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-full justify-center gap-2 text-xs font-medium text-sidebar-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
              disabled={loggingOut}
              onClick={handleLogout}
            >
              {loggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  ログアウト中…
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  ログアウト
                </>
              )}
            </Button>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
