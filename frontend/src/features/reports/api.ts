import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import type { InputUnit, LineMemoField, VehicleSelectMode } from "@/lib/reports/business-type-rules";
import { compressReportImage } from "@/lib/reports/image-compression";

export type ReportImageMeta = { imageId: string; sortOrder: number };

export type BusinessReport = {
  id: string;
  staff_id: string;
  staff_name: string;
  site_id: string;
  site_name: string;
  client_id: string;
  client_name: string;
  business_type_id: string;
  business_type_name: string;
  business_line_name: string | null;
  count: number;
  image_url: string | null;
  /** Multi-image attachments (report_images). image_url is kept for legacy rows. */
  images: ReportImageMeta[];
  image_count: number;
  memo: string | null;
  session_memo: string | null;
  session_submitted_at?: string | null;
  work_date?: string | null;
  unit_price_excl?: number | null;
  unit_price_incl?: number | null;
  line_amount_excl?: number | null;
  line_amount_incl?: number | null;
  reported_at: string;
  created_at: string;
  updated_at: string;
};

export type BusinessLine = { id: string; name: string; sort_order: number; client_count?: number };
export type ReportClient = { id: string; name: string; code: string; site_count: number };
export type ReportSite = { id: string; client_id: string; client_name: string; name: string; is_billing_branch: boolean };
export type ReportBusinessType = {
  id: string;
  client_id: string;
  client_name: string;
  site_id: string | null;
  name: string;
  input_unit?: InputUnit;
  vehicle_select_mode?: VehicleSelectMode | null;
  line_memo_fields?: LineMemoField[];
  unit_price_excl?: number;
  unit_price_incl?: number;
};

export type ReportVehicle = {
  id: string;
  station_name: string | null;
  vehicle_label: string;
  surcharge_label: string | null;
  vehicle_list_id: string;
  vehicle_list_name: string;
};

const STALE = 15_000;

type ListParams = {
  date?: string;
  from?: string;
  to?: string;
  staff_id?: string;
  site_id?: string;
  client_id?: string;
};

function buildQs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function useReports(params: ListParams = {}) {
  return useQuery({
    queryKey: ["reports", "list", params],
    queryFn: () => apiGet<{ items: BusinessReport[] }>(`/api/reports${buildQs(params)}`),
    staleTime: STALE,
  });
}

export function useMyBusinessLines() {
  return useQuery({
    queryKey: ["me", "business-lines"],
    queryFn: () => apiGet<{ items: BusinessLine[] }>("/api/me/business-lines"),
    staleTime: 60_000,
  });
}

export function useMyReportClients(businessLineId: string | null) {
  return useQuery({
    queryKey: ["me", "clients", businessLineId],
    queryFn: () =>
      apiGet<{ items: ReportClient[] }>(
        `/api/me/clients?business_line_id=${businessLineId}`,
      ),
    enabled: !!businessLineId,
    staleTime: 60_000,
  });
}

export function useMyReportSites(clientId: string | null) {
  return useQuery({
    queryKey: ["me", "report-sites", clientId],
    queryFn: () => apiGet<{ items: ReportSite[] }>(`/api/me/sites?client_id=${clientId}`),
    enabled: !!clientId,
    staleTime: 60_000,
  });
}

export function useMyReportBusinessTypes(
  businessLineId: string | null,
  clientId: string | null,
  siteId: string | null,
  ready = true,
) {
  return useQuery({
    queryKey: ["me", "report-business-types", businessLineId, clientId, siteId],
    queryFn: () => {
      const qs = new URLSearchParams({
        business_line_id: businessLineId!,
        client_id: clientId!,
      });
      if (siteId) qs.set("site_id", siteId);
      return apiGet<{ items: ReportBusinessType[] }>(`/api/me/business-types?${qs}`);
    },
    enabled: ready && !!businessLineId && !!clientId,
    staleTime: 60_000,
  });
}

export function useMyReportVehicles(clientId: string | null, businessLineId: string | null) {
  return useQuery({
    queryKey: ["me", "report-vehicles", clientId, businessLineId],
    queryFn: () => {
      const qs = new URLSearchParams({ client_id: clientId! });
      if (businessLineId) qs.set("business_line_id", businessLineId);
      return apiGet<{ items: ReportVehicle[] }>(`/api/me/vehicles?${qs}`);
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });
}

export type SessionEntry = {
  business_type_id: string;
  count: number;
  vehicle_id?: string | null;
  line_memo?: Record<string, string> | null;
};

export type CustomerBlock = {
  client_id: string;
  site_id?: string | null;
  entries: SessionEntry[];
};

export type CreateSessionInput = {
  work_date: string;
  business_line_id: string;
  memo?: string | null;
  customer_blocks: CustomerBlock[];
};

export function useCreateReportSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSessionInput) =>
      apiPost<{ item: { id: string; entry_count: number } }>("/api/reports/sessions", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

/* ---------- Drafts (一時保存) ----------
 * Server-persisted draft of the in-progress report form. The payload is an
 * opaque snapshot owned by ReportSessionForm; the backend stores it verbatim
 * and creates no business_reports rows, so drafts never reach analytics.
 */

export async function saveReportDraft(
  workDate: string,
  businessLineId: string,
  payload: Record<string, unknown>,
): Promise<{ item: { id: string; saved_at: string } }> {
  return apiPost("/api/reports/sessions/draft", {
    work_date: workDate,
    business_line_id: businessLineId,
    payload,
  });
}

export async function fetchReportDraft(
  workDate: string,
  businessLineId: string,
): Promise<Record<string, unknown> | null> {
  const qs = new URLSearchParams({
    work_date: workDate,
    business_line_id: businessLineId,
  }).toString();
  const res = await apiGet<{ item: { id: string; payload: Record<string, unknown> } | null }>(
    `/api/reports/sessions/draft?${qs}`,
  );
  return res.item?.payload ?? null;
}

export async function deleteReportDraft(
  workDate: string,
  businessLineId: string,
): Promise<void> {
  const qs = new URLSearchParams({
    work_date: workDate,
    business_line_id: businessLineId,
  }).toString();
  await apiDelete(`/api/reports/sessions/draft?${qs}`);
}

/* ---------- Dispatch labour costs (派遣人件費) ---------- */

export type DispatchLaborCost = {
  id?: string;
  name: string;
  hours: number;
  labor_cost: number;
};

export function useDispatchLabor(sessionId: string | null) {
  return useQuery({
    queryKey: ["reports", "dispatch-labor", sessionId],
    queryFn: () =>
      apiGet<{ items: DispatchLaborCost[] }>(
        `/api/reports/sessions/${sessionId}/dispatch-labor`,
      ),
    enabled: !!sessionId,
  });
}

export function useReplaceDispatchLabor(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: DispatchLaborCost[]) =>
      apiPut<{ items: DispatchLaborCost[] }>(
        `/api/reports/sessions/${sessionId}/dispatch-labor`,
        { items },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", "dispatch-labor", sessionId] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export type ReportSessionEntry = {
  id: string;
  client_id: string;
  client_name: string;
  site_id: string;
  site_name: string;
  business_type_id: string;
  business_type_name: string;
  count: number;
  image_url?: string | null;
  vehicle_id?: string | null;
  vehicle_label?: string | null;
  line_memo?: Record<string, string> | null;
  auto_generated?: boolean;
};

export type ReportSession = {
  id: string;
  staff_id: string;
  staff_name?: string;
  work_date: string;
  business_line_id: string;
  business_line_name: string;
  memo: string | null;
  submitted_at: string;
  entries: ReportSessionEntry[];
};

type SessionListParams = { work_date?: string; business_line_id?: string };

function buildSessionQs(params: SessionListParams): string {
  const u = new URLSearchParams();
  if (params.work_date) u.set("work_date", params.work_date);
  if (params.business_line_id) u.set("business_line_id", params.business_line_id);
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function useReportSessions(params: SessionListParams = {}) {
  return useQuery({
    queryKey: ["reports", "sessions", params],
    queryFn: () =>
      apiGet<{ items: ReportSession[] }>(`/api/reports/sessions${buildSessionQs(params)}`),
    staleTime: STALE,
  });
}

export function useReportSession(id: string | null) {
  return useQuery({
    queryKey: ["reports", "session", id],
    queryFn: () => apiGet<{ item: ReportSession }>(`/api/reports/sessions/${id}`),
    enabled: !!id,
    staleTime: STALE,
  });
}

export function useUpdateReportSession(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSessionInput) =>
      apiPatch<{ item: ReportSession }>(`/api/reports/sessions/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useDeleteReportSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/reports/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export type PatchReportInput = {
  site_id?: string;
  business_type_id?: string;
  count?: number;
  memo?: string | null;
  reported_at?: string;
  image_url?: string | null;
};

export function usePatchReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PatchReportInput) =>
      apiPatch<{ item: BusinessReport }>(`/api/reports/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

/**
 * Single report fetch for the admin detail dialog. The list endpoint
 * already returns every column we display, so this is mostly a freshness
 * guarantee (the dialog opens long after the list was cached).
 */
export function useReport(id: string | null) {
  return useQuery({
    queryKey: ["reports", "detail", id],
    queryFn: () => apiGet<{ item: BusinessReport }>(`/api/reports/${id}`),
    enabled: !!id,
    staleTime: STALE,
  });
}

/**
 * DELETE /api/reports/:id. Backend authorises admin / owning employee.
 * On success the list cache + this row's detail are invalidated.
 */
export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/reports/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.removeQueries({ queryKey: ["reports", "detail", id] });
    },
  });
}

/**
 * Compress + upload a report attachment.
 *
 * Two-step flow that matches the NestJS backend:
 *   1. POST `/api/uploads/presign` → `{ uploadUrl, objectKey, expiresIn }`
 *   2. PUT the compressed bytes directly to S3 at `uploadUrl`
 *
 * Returns the S3 object key (NOT a public URL) — `business_reports.image_url`
 * stores that key, and reads go through the auth-gated proxy at
 * `GET /api/reports/:id/image`. This keeps objects private and lets the
 * backend re-check access on every fetch.
 *
 * If the backend isn't configured (e.g. S3 credentials missing), the presign
 * call may 5xx — the caller catches that and shows a toast without failing
 * the whole report submission.
 */
/**
 * Coerce a (possibly Japanese / emoji / symbol-laden) filename into what the
 * presign endpoint accepts: `^[A-Za-z0-9._\- ]{1,128}$`. The server appends a
 * UUID to form the object key, so the name is cosmetic — we just need it valid.
 * Non-allowed chars become `_`; the extension is preserved when present.
 */
function sanitizeUploadFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "") : "";
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^A-Za-z0-9._\- ]/g, "_");
  const safeBase = base.replace(/^[\s_]+|[\s_]+$/g, "") || "image";
  const full = ext ? `${safeBase}.${ext}` : safeBase;
  return full.slice(0, 128);
}

export async function uploadReportImage(file: File): Promise<{
  url: string;
  finalBytes: number;
  originalBytes: number;
}> {
  const compressed = await compressReportImage(file);

  const presign = await apiPost<{ uploadUrl: string; objectKey: string }>(
    "/api/uploads/presign",
    {
      filename: sanitizeUploadFilename(compressed.file.name),
      contentType: compressed.file.type,
      contentLength: compressed.file.size,
    },
  );

  // Direct browser-to-S3 PUT. We don't include credentials here — the
  // presigned URL is the only authorization the bucket needs. Setting
  // Content-Type is required because the presign locked it in.
  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": compressed.file.type },
    body: compressed.file,
  });
  if (!putRes.ok) {
    throw new Error(`S3 upload failed (${putRes.status})`);
  }

  return {
    url: presign.objectKey,
    finalBytes: compressed.finalBytes,
    originalBytes: compressed.originalBytes,
  };
}

/** Max images per report — mirrors the server-side cap (ReportsService.MAX_IMAGES). */
export const MAX_REPORT_IMAGES = 10;

export type MultiUploadResult = {
  objectKeys: string[];
  originalBytes: number;
  finalBytes: number;
};

/**
 * Compress + upload several images, returning their object keys in order.
 * Uploads run sequentially to keep memory/bandwidth predictable on mobile.
 */
export async function uploadReportImages(files: File[]): Promise<MultiUploadResult> {
  const objectKeys: string[] = [];
  let originalBytes = 0;
  let finalBytes = 0;
  for (const file of files) {
    const r = await uploadReportImage(file);
    objectKeys.push(r.url);
    originalBytes += r.originalBytes;
    finalBytes += r.finalBytes;
  }
  return { objectKeys, originalBytes, finalBytes };
}

/** Attach uploaded object keys to a report (server enforces the 10-image cap). */
export async function attachReportImages(
  reportId: string,
  objectKeys: string[],
): Promise<{ items: ReportImageMeta[] }> {
  return apiPost<{ items: ReportImageMeta[] }>(`/api/reports/${reportId}/images`, {
    objectKeys,
  });
}
