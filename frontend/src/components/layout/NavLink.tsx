"use client";

import type { AnchorHTMLAttributes } from "react";
import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

function pathIsActive(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to;
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

type NavLinkProps = {
  to: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  end?: boolean;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps & Pick<LinkProps, "replace">>(
  ({ className, activeClassName, pendingClassName, to, end, children, ...props }, ref) => {
    const pathname = usePathname() ?? "/";
    const isActive = pathIsActive(pathname, to, end);

    return (
      <Link
        ref={ref}
        href={to}
        className={cn(className, isActive && activeClassName)}
        {...props}
      >
        {children}
      </Link>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
