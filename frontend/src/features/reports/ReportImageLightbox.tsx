"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportImageSrc } from "@/lib/reports/format";
import { formatJPDateTime } from "@/lib/dates";

export type LightboxItem = {
  id: string;
  client_name: string;
  staff_name?: string;
  reported_at: string;
};

/**
 * Full-screen image viewer with prev/next navigation across all images
 * present in the current report list. Used by the admin report table.
 *
 * - Esc to close
 * - ← / → to navigate
 * - Click backdrop to close
 */
export function ReportImageLightbox({
  items,
  currentId,
  onClose,
  onNavigate,
}: {
  items: LightboxItem[];
  currentId: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const idx = items.findIndex((i) => i.id === currentId);
  const current = idx >= 0 ? items[idx] : null;

  const goPrev = useCallback(() => {
    if (idx <= 0) return;
    onNavigate(items[idx - 1]!.id);
  }, [idx, items, onNavigate]);

  const goNext = useCallback(() => {
    if (idx < 0 || idx >= items.length - 1) return;
    onNavigate(items[idx + 1]!.id);
  }, [idx, items, onNavigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="報告画像"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 h-10 w-10 text-white hover:bg-white/10 hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="閉じる"
      >
        <X className="h-5 w-5" />
      </Button>

      {idx > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute left-3 top-1/2 h-12 w-12 -translate-y-1/2 text-white hover:bg-white/10 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="前の画像"
        >
          <ChevronLeft className="h-7 w-7" />
        </Button>
      )}

      {idx < items.length - 1 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-1/2 h-12 w-12 -translate-y-1/2 text-white hover:bg-white/10 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="次の画像"
        >
          <ChevronRight className="h-7 w-7" />
        </Button>
      )}

      <figure
        className="flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- backend image proxy; next/image can't optimise it */}
        <img
          key={current.id}
          src={reportImageSrc(current.id)}
          alt={`${current.client_name} の報告画像`}
          className="max-h-[78vh] max-w-full rounded-md bg-black object-contain shadow-2xl"
        />
        <figcaption className="rounded-md bg-black/70 px-3 py-1.5 text-center text-xs text-white">
          {current.staff_name ? `${current.staff_name} / ` : ""}
          {current.client_name} — {formatJPDateTime(current.reported_at)}
          <span className="ml-2 text-white/60">
            ({idx + 1}/{items.length})
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

/** Hook returning state and helpers for the lightbox. */
export function useReportLightbox() {
  const [currentId, setCurrentId] = useState<string | null>(null);
  return {
    currentId,
    open: (id: string) => setCurrentId(id),
    close: () => setCurrentId(null),
    setCurrentId,
  };
}
