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
};

export type Site = {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
};

export type BusinessType = {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
};

export type Staff = {
  id: string;
  name: string;
  hourly_rate: number;
  department_id: string;
  department_name: string;
  site_ids: string[];
};

const STALE = 30_000;
type Opts = { enabled?: boolean };

/* ---------- Queries ---------- */

export function useDepartments({ enabled = true }: Opts = {}) {
  return useQuery({
    queryKey: ["master", "departments"],
    queryFn: () => apiGet<{ items: Department[] }>("/api/master/departments"),
    staleTime: STALE,
    enabled,
  });
}

export function useClients({ enabled = true }: Opts = {}) {
  return useQuery({
    queryKey: ["master", "clients"],
    queryFn: () => apiGet<{ items: ClientCompany[] }>("/api/master/clients"),
    staleTime: STALE,
    enabled,
  });
}

export function useSites({ enabled = true }: Opts = {}) {
  return useQuery({
    queryKey: ["master", "sites"],
    queryFn: () => apiGet<{ items: Site[] }>("/api/master/sites"),
    staleTime: STALE,
    enabled,
  });
}

export function useBusinessTypes({ enabled = true }: Opts = {}) {
  return useQuery({
    queryKey: ["master", "business-types"],
    queryFn: () => apiGet<{ items: BusinessType[] }>("/api/master/business-types"),
    staleTime: STALE,
    enabled,
  });
}

export function useStaffs({ enabled = true }: Opts = {}) {
  return useQuery({
    queryKey: ["master", "staffs"],
    queryFn: () => apiGet<{ items: Staff[] }>("/api/master/staffs"),
    staleTime: STALE,
    enabled,
  });
}

/* ---------- Mutations ----------
 * Each set invalidates the corresponding list query so a Create/Update/Delete
 * triggers a refetch. We don't do optimistic updates here — server validation
 * (FK violations, unique-on-live, etc.) is rich enough that a brief loading
 * state is honester than an optimistic toggle that we'd have to reverse.
 */

function useInvalidate(keyHead: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["master", keyHead] });
}

// Departments
export type DepartmentInput = { name: string };
export function useCreateDepartment() {
  const inv = useInvalidate("departments");
  return useMutation({
    mutationFn: (v: DepartmentInput) =>
      apiPost<{ item: Department }>("/api/master/departments", v),
    onSuccess: inv,
  });
}
export function useUpdateDepartment() {
  const inv = useInvalidate("departments");
  return useMutation({
    mutationFn: ({ id, ...v }: DepartmentInput & { id: string }) =>
      apiPatch<{ item: Department }>(`/api/master/departments/${id}`, v),
    onSuccess: inv,
  });
}
export function useDeleteDepartment() {
  const inv = useInvalidate("departments");
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/master/departments/${id}`),
    onSuccess: inv,
  });
}

// Clients
export type ClientInput = { name: string; code: string };
export function useCreateClient() {
  const inv = useInvalidate("clients");
  return useMutation({
    mutationFn: (v: ClientInput) =>
      apiPost<{ item: ClientCompany }>("/api/master/clients", v),
    onSuccess: inv,
  });
}
export function useUpdateClient() {
  const inv = useInvalidate("clients");
  return useMutation({
    mutationFn: ({ id, ...v }: Partial<ClientInput> & { id: string }) =>
      apiPatch<{ item: ClientCompany }>(`/api/master/clients/${id}`, v),
    onSuccess: inv,
  });
}
export function useDeleteClient() {
  const inv = useInvalidate("clients");
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/master/clients/${id}`),
    onSuccess: inv,
  });
}

// Sites
export type SiteInput = {
  client_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
};
export function useCreateSite() {
  const inv = useInvalidate("sites");
  return useMutation({
    mutationFn: (v: SiteInput) => apiPost<{ item: Site }>("/api/master/sites", v),
    onSuccess: inv,
  });
}
export function useUpdateSite() {
  const inv = useInvalidate("sites");
  return useMutation({
    mutationFn: ({ id, ...v }: Partial<SiteInput> & { id: string }) =>
      apiPatch<{ item: Site }>(`/api/master/sites/${id}`, v),
    onSuccess: inv,
  });
}
export function useDeleteSite() {
  const inv = useInvalidate("sites");
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/master/sites/${id}`),
    onSuccess: inv,
  });
}

// Business Types
export type BusinessTypeInput = { client_id: string; name: string };
export function useCreateBusinessType() {
  const inv = useInvalidate("business-types");
  return useMutation({
    mutationFn: (v: BusinessTypeInput) =>
      apiPost<{ item: BusinessType }>("/api/master/business-types", v),
    onSuccess: inv,
  });
}
export function useUpdateBusinessType() {
  const inv = useInvalidate("business-types");
  return useMutation({
    mutationFn: ({ id, ...v }: Partial<BusinessTypeInput> & { id: string }) =>
      apiPatch<{ item: BusinessType }>(`/api/master/business-types/${id}`, v),
    onSuccess: inv,
  });
}
export function useDeleteBusinessType() {
  const inv = useInvalidate("business-types");
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/master/business-types/${id}`),
    onSuccess: inv,
  });
}

// Staffs
export type StaffInput = {
  name: string;
  department_id: string;
  hourly_rate: number;
  site_ids: string[];
};
export function useCreateStaff() {
  const inv = useInvalidate("staffs");
  return useMutation({
    mutationFn: (v: StaffInput) => apiPost<{ item: Staff }>("/api/master/staffs", v),
    onSuccess: inv,
  });
}
export function useUpdateStaff() {
  const inv = useInvalidate("staffs");
  return useMutation({
    mutationFn: ({ id, ...v }: Partial<StaffInput> & { id: string }) =>
      apiPatch<{ item: Staff }>(`/api/master/staffs/${id}`, v),
    onSuccess: inv,
  });
}
export function useDeleteStaff() {
  const inv = useInvalidate("staffs");
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/master/staffs/${id}`),
    onSuccess: inv,
  });
}
