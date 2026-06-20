import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page content wrapper: caps width on large screens and applies
 * consistent vertical rhythm. Horizontal gutters are handled by the layout's
 * <main> padding, so this only owns max-width + vertical spacing.
 *
 * `width`:
 *  - "default" (max-w-screen-xl) for dense/admin pages with tables
 *  - "narrow"  (max-w-2xl) for focused single-column flows (settings, forms)
 */
export function PageContainer({
  children,
  width = "default",
  className,
}: {
  children: React.ReactNode;
  width?: "default" | "narrow";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-4 sm:space-y-6",
        width === "narrow" ? "max-w-2xl" : "max-w-screen-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
