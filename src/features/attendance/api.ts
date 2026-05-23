import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";

export type AttendanceStatus = "working" | "done" | "absent";

export type AttendanceLog = {
  id: string;
  staff_id: string;
  staff_name?: string;
  site_id: string;
  site_name?: string;
  work_date: string;
  punch_in_at: string;
  punch_out_at: string | null;
  status: AttendanceStatus;
  punch_in_lat: number | null;
  punch_in_lng: number | null;
  punch_out_lat: number | null;
  punch_out_lng: number | null;
};

export type AttendanceStats = {
  work_date: string;
  total: number;
  present: number;
  working: number;
  done: number;
  late: number;
  absent: number;
};

const STALE = 15_000;

type ListParams = {
  date?: string;
  from?: string;
  to?: string;
  staff_id?: string;
  site_id?: string;
};

function buildQs(params: ListParams): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function useAttendance(params: ListParams = {}) {
  return useQuery({
    queryKey: ["attendance", "list", params],
    queryFn: () => apiGet<{ items: AttendanceLog[] }>(`/api/attendance${buildQs(params)}`),
    staleTime: STALE,
  });
}

export function useAttendanceToday() {
  return useQuery({
    queryKey: ["attendance", "today"],
    queryFn: () =>
      apiGet<{ item: AttendanceLog | null; work_date: string }>("/api/attendance/today"),
    staleTime: STALE,
  });
}

export function useAttendanceStats(date?: string) {
  return useQuery({
    queryKey: ["attendance", "stats", date ?? "today"],
    queryFn: () =>
      apiGet<AttendanceStats>(
        `/api/attendance/stats${date ? `?date=${date}` : ""}`,
      ),
    staleTime: STALE,
  });
}

export function usePunchIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { site_id: string; latitude: number; longitude: number }) =>
      apiPost<{ item: AttendanceLog }>("/api/attendance/punch-in", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function usePunchOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { latitude?: number; longitude?: number } = {}) =>
      apiPost<{ item: AttendanceLog }>("/api/attendance/punch-out", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export type MySite = {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
};

export function useMySites() {
  return useQuery({
    queryKey: ["me", "sites"],
    queryFn: () => apiGet<{ items: MySite[] }>("/api/me/sites"),
    staleTime: 60_000,
  });
}
