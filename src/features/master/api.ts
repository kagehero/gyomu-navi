import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

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

export function useDepartments() {
  return useQuery({
    queryKey: ["master", "departments"],
    queryFn: () => apiGet<{ items: Department[] }>("/api/master/departments"),
    staleTime: STALE,
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["master", "clients"],
    queryFn: () => apiGet<{ items: ClientCompany[] }>("/api/master/clients"),
    staleTime: STALE,
  });
}

export function useSites() {
  return useQuery({
    queryKey: ["master", "sites"],
    queryFn: () => apiGet<{ items: Site[] }>("/api/master/sites"),
    staleTime: STALE,
  });
}

export function useBusinessTypes() {
  return useQuery({
    queryKey: ["master", "business-types"],
    queryFn: () => apiGet<{ items: BusinessType[] }>("/api/master/business-types"),
    staleTime: STALE,
  });
}

export function useStaffs() {
  return useQuery({
    queryKey: ["master", "staffs"],
    queryFn: () => apiGet<{ items: Staff[] }>("/api/master/staffs"),
    staleTime: STALE,
  });
}
