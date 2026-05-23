import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { upload } from "@vercel/blob/client";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

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
  count: number;
  image_url: string | null;
  memo: string | null;
  reported_at: string;
  created_at: string;
  updated_at: string;
};

export type BusinessTypeOption = {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
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

function buildQs(params: ListParams): string {
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

export function useMyBusinessTypes() {
  return useQuery({
    queryKey: ["me", "business-types"],
    queryFn: () => apiGet<{ items: BusinessTypeOption[] }>("/api/me/business-types"),
    staleTime: 60_000,
  });
}

export type CreateReportInput = {
  site_id: string;
  business_type_id: string;
  count: number;
  memo?: string | null;
  image_url?: string | null;
  reported_at?: string;
  staff_id?: string; // admin only
};

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReportInput) =>
      apiPost<{ item: BusinessReport }>("/api/reports", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export type PatchReportInput = Partial<Omit<CreateReportInput, "staff_id">>;

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
 * Upload an image via the Vercel Blob client SDK. The SDK talks to
 * /api/reports/upload-url to get a signed token, then PUTs directly to Blob.
 *
 * Returns the public URL to store in business_reports.image_url. If the server
 * 503s with `blob_unconfigured`, the caller should fall back to submitting
 * without an image.
 */
export async function uploadReportImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const pathname = `reports/${crypto.randomUUID()}.${ext}`;
  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/reports/upload-url",
  });
  return blob.url;
}
