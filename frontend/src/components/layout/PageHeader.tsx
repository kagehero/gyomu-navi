import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Consistent page heading used across all screens.
 *
 * - `title`: required page title (responsive size via `.text-title`)
 * - `description`: optional one-line subtitle
 * - `actions`: optional right-aligned controls (buttons, etc.). On SP they
 *   wrap below the title; from `sm` up they sit on the same row.
 *
 * Keeps spacing/typography uniform so every page reads the same.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <h1 className="text-title truncate">{title}</h1>
        {description && <p className="text-subtitle">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
