import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { InputUnit, LineMemoField, VehicleSelectMode } from "@/lib/reports/business-type-rules";

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
  memo: string | null;
  session_memo: string | null;
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

export type ReportSessionEntry = {
  id: string;
  client_id: string;
  client_name: string;
  site_id: string;
  site_name: string;
  business_type_id: string;
  business_type_name: string;
  count: number;
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
