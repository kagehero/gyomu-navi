"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

function pathIsActive(pathname: string, href: string, end: boolean) {
  if (end) return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const items = [
  { href: "/", end: true as const, label: "ホーム", icon: LayoutDashboard },
  { href: "/reports", end: false as const, label: "業務報告", icon: ClipboardList },
  { href: "/attendance", end: false as const, label: "勤怠", icon: Clock },
  { href: "/notices", end: false as const, label: "連絡", icon: MessageSquare },
] as const;

export function EmployeeBottomNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      className="employee-nav-safe absolute bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom,0.5rem)] pt-1 backdrop-blur-md sm:rounded-b-2xl"
      aria-label="メインメニュー"
    >
      <div className="flex justify-around">
        {items.map(({ href, end, label, icon: Icon }) => {
          const isActive = pathIsActive(pathname, href, end);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-12 min-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors",
                isActive && "text-primary",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
