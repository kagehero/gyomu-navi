"use client";

import Link from "next/link";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotices } from "@/features/notices/api";
import { formatJPDate } from "@/lib/dates";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const noticesQ = useNotices();
  const unreadCount = (noticesQ.data?.items ?? []).filter((n) => !n.is_read).length;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-muted-foreground" />
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {formatJPDate(new Date())}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                asChild
                aria-label={unreadCount > 0 ? `未読の連絡 ${unreadCount} 件` : "連絡・掲示板"}
              >
                <Link href="/notices">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
