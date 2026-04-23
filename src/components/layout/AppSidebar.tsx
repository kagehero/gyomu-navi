"use client";

import {
  LayoutDashboard,
  ClipboardList,
  Clock,
  MessageSquare,
  Settings,
  Building2,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/layout/NavLink";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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

const mainItems = [
  { title: "ダッシュボード", url: "/", icon: LayoutDashboard },
  { title: "業務報告", url: "/reports", icon: ClipboardList },
  { title: "勤怠管理", url: "/attendance", icon: Clock },
  { title: "連絡・掲示板", url: "/notices", icon: MessageSquare },
];

const adminItems = [
  { title: "マスタ管理", url: "/master", icon: Building2 },
  { title: "設定", url: "/settings", icon: Settings },
];

function displayInitial(name: string) {
  const t = name.trim();
  if (!t) return "?";
  return t[0]!.toUpperCase();
}

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, logout } = useAuth();
  const router = useRouter();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Building2 className="h-4 w-4 text-sidebar-primary-foreground" />
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
              {mainItems.map((item) => (
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
      </SidebarContent>

      <SidebarFooter className="space-y-2 border-t border-sidebar-border px-2 py-3">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-medium text-sidebar-primary">
              {user ? displayInitial(user.displayName || user.email) : "?"}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-medium text-sidebar-primary">
                {user ? displayInitial(user.displayName || user.email) : "?"}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-sidebar-foreground">
                  {user?.displayName || "—"}
                </span>
                <span className="truncate text-[10px] text-sidebar-foreground/50">
                  {user?.email}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={async () => {
                try {
                  await logout();
                  toast.success("ログアウトしました");
                  router.replace("/login");
                } catch {
                  toast.error("ログアウトに失敗しました");
                }
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              ログアウト
            </Button>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
