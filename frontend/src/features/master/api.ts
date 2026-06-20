import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

export type Department = {
  id: string;
  name: string;
};

export type ClientCompany = {
  id: string;
  name: string;
  code: string;
  business_line_ids?: string[];
};

export type Site = {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  is_billing_branch: boolean;
};

export type BusinessType = {
  id: string;
  client_id: string;
  client_name: string;
  site_id: string | null;
  site_name: string | null;
  business_line_id: string | null;
  business_line_name: string | null;
  name: string;
  unit_price_excl: number | null;
  unit_price_incl: number | null;
};

export type Staff = {
  id: string;
  name: string;
  hourly_rate: number;
  department_id: string | null;
  department_name: string | null;
  client_ids: string[];
  business_line_ids: string[];
  login_email: string | null;
  login_approved_at: string | null;
};

export type BusinessLine = { id: string; name: string; sort_order: number };

const STALE = 30_000;
type Opts = { enabled?: boolean };

/* ---------- Factories ---------- */

/**
 * Each master resource needs the same four hooks: list, create, update, delete.
 * The factories below keep the per-resource boilerplate to a single call so
 * adding a new master only takes 5 lines.
 *
 * Public hook names are preserved (useDepartments, useCreateDepartment, …) so
 * call sites don't change.
 */
function listHook<T>(slug: string) {
  return ({ enabled = true }: Opts = {}) =>
    useQuery({
      queryKey: ["master", slug],
      queryFn: () => apiGet<{ items: T[] }>(`/api/master/${slug}`),
      staleTime: STALE,
      enabled,
    });
}

function useInvalidate(slug: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["master", slug] });
}

function createHook<TItem, TInput extends object>(slug: string) {
  return () => {
    const inv = useInvalidate(slug);
    return useMutation({
      mutationFn: (v: TInput) => apiPost<{ item: TItem }>(`/api/master/${slug}`, v),
      onSuccess: inv,
    });
  };
}

function updateHook<TItem, TInput extends object>(slug: string) {
  return () => {
    const inv = useInvalidate(slug);
    return useMutation({
      mutationFn: ({ id, ...v }: Partial<TInput> & { id: string }) =>
        apiPatch<{ item: TItem }>(`/api/master/${slug}/${id}`, v),
      onSuccess: inv,
    });
  };
}

function deleteHook(slug: string) {
  return () => {
    const inv = useInvalidate(slug);
    return useMutation({
      mutationFn: (id: string) => apiDelete(`/api/master/${slug}/${id}`),
      onSuccess: inv,
    });
  };
}

/* ---------- Queries ---------- */

export const useDepartments = listHook<Department>("departments");
export const useClients = listHook<ClientCompany>("clients");
export const useSites = listHook<Site>("sites");
export const useBusinessTypes = listHook<BusinessType>("business-types");
export const useStaffs = listHook<Staff>("staffs");
export const useBusinessLines = listHook<BusinessLine>("business-lines");

/* ---------- Mutations ---------- */

// Departments (HR internal)
export type DepartmentInput = { name: string };
export const useCreateDepartment = createHook<Department, DepartmentInput>("departments");
export const useUpdateDepartment = updateHook<Department, DepartmentInput>("departments");
export const useDeleteDepartment = deleteHook("departments");

// Business lines (reporting departments)
export type BusinessLineInput = { name: string; sort_order?: number };
export const useCreateBusinessLine = createHook<BusinessLine, BusinessLineInput>("business-lines");
export const useUpdateBusinessLine = updateHook<BusinessLine, BusinessLineInput>("business-lines");
export const useDeleteBusinessLine = deleteHook("business-lines");

// Clients
export type ClientInput = { name: string; code: string; business_line_ids?: string[] };
export const useCreateClient = createHook<ClientCompany, ClientInput>("clients");
export const useUpdateClient = updateHook<ClientCompany, ClientInput>("clients");
export const useDeleteClient = deleteHook("clients");

// Sites
export type SiteInput = {
  client_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  is_billing_branch?: boolean;
};
export const useCreateSite = createHook<Site, SiteInput>("sites");
export const useUpdateSite = updateHook<Site, SiteInput>("sites");
export const useDeleteSite = deleteHook("sites");

// Business Types
export type BusinessTypeInput = {
  client_id: string;
  name: string;
  site_id?: string | null;
  business_line_id?: string | null;
  unit_price_excl?: number | null;
  unit_price_incl?: number | null;
};
export const useCreateBusinessType = createHook<BusinessType, BusinessTypeInput>("business-types");
export const useUpdateBusinessType = updateHook<BusinessType, BusinessTypeInput>("business-types");
export const useDeleteBusinessType = deleteHook("business-types");

// Staffs
export type StaffInput = {
  name?: string;
  department_id?: string;
  hourly_rate?: number;
  client_ids?: string[];
  business_line_ids?: string[];
  approve?: boolean;
};
export const useCreateStaff = createHook<Staff, StaffInput>("staffs");
export const useUpdateStaff = updateHook<Staff, StaffInput>("staffs");
export const useDeleteStaff = deleteHook("staffs");

export type BulkApproveResult = {
  approved: string[];
  skipped: { id: string; reason: string }[];
};

/**
 * Bulk-approve pending employee logins (顧客要望: 一括承認). Only staff that
 * already have a department, ≥1 client and ≥1 business line are approved; the
 * rest come back in `skipped` with a reason so the admin knows who still needs
 * setup.
 */
export function useBulkApproveStaff() {
  const inv = useInvalidate("staffs");
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiPost<BulkApproveResult>("/api/master/staffs/bulk-approve", { ids }),
    onSuccess: inv,
  });
}
