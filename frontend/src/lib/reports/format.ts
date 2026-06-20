import { formatJPDateTime } from "@/lib/dates";

/** Format an ISO timestamp for display in JST (date + time). */
export function formatReportDateTime(iso: string): string {
  return formatJPDateTime(iso);
}

/** Prefer session submission time; fall back to row reported_at. */
export function reportDisplayTimestamp(row: {
  session_submitted_at?: string | null;
  reported_at: string;
}): string {
  return row.session_submitted_at ?? row.reported_at;
}

export function reportImageSrc(reportId: string): string {
  return `/api/reports/${reportId}/image`;
}

/** URL for a specific report image (multi-image: report_images.id). */
export function reportImageByIdSrc(reportId: string, imageId: string): string {
  return `/api/reports/${reportId}/images/${imageId}`;
}
