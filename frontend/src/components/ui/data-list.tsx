"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/**
 * Responsive data list: renders SP-friendly cards on small screens and a
 * full table from `md` up — the pattern proven in ReportsPage, generalised so
 * every list screen (master CRUD, notices, etc.) gets the same UX:
 *
 *   <DataList
 *     items={rows}
 *     isLoading={q.isLoading}
 *     error={q.error}
 *     getKey={(r) => r.id}
 *     empty={{ title: "...", description: "..." }}
 *     renderCard={(r) => <MyCard row={r} />}
 *     table={{ head: <tr>…</tr>, renderRow: (r) => <tr>…</tr>, minWidth: 720 }}
 *   />
 *
 * Loading and empty states are handled once, here.
 */
export function DataList<T>({
  items,
  isLoading,
  error,
  getKey,
  renderCard,
  table,
  empty,
  className,
}: {
  items: T[];
  isLoading?: boolean;
  error?: unknown;
  getKey: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  table: {
    head: React.ReactNode;
    renderRow: (item: T) => React.ReactNode;
    /** Minimum table width (px) before horizontal scroll kicks in. */
    minWidth?: number;
  };
  empty: { icon?: React.ElementType; title: string; description?: string; actionLabel?: string; onAction?: () => void };
  className?: string;
}) {
  const isEmpty = !isLoading && items.length === 0;
  const errorMessage =
    error instanceof Error ? error.message : error ? "読み込みに失敗しました" : null;

  return (
    <div className={className}>
      {/* SP: card list */}
      <div className="space-y-2 md:hidden">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {errorMessage && (
          <p className="px-3 py-4 text-center text-sm text-destructive">{errorMessage}</p>
        )}
        {isEmpty && !errorMessage && <EmptyState {...empty} />}
        {!isLoading && items.map((item) => (
          <React.Fragment key={getKey(item)}>{renderCard(item)}</React.Fragment>
        ))}
      </div>

      {/* PC/tablet: table */}
      <div className="hidden md:block">
        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {errorMessage && (
          <p className="px-3 py-6 text-center text-sm text-destructive">{errorMessage}</p>
        )}
        {isEmpty && !errorMessage && <EmptyState {...empty} />}
        {!isLoading && !isEmpty && (
          <div className="overflow-x-auto">
            <table
              className={cn("data-table text-xs sm:text-sm")}
              style={table.minWidth ? { minWidth: table.minWidth } : undefined}
            >
              <thead>{table.head}</thead>
              <tbody>
                {items.map((item) => (
                  <React.Fragment key={getKey(item)}>{table.renderRow(item)}</React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
