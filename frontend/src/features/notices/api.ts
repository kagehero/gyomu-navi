import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPostEmpty } from "@/lib/api";

export type Notice = {
  id: string;
  from_user_id: string;
  from_display_name: string;
  target_type: "all" | "department" | "individual";
  target_department_id: string | null;
  target_department_name: string | null;
  target_user_id: string | null;
  target_user_display_name: string | null;
  client_id: string | null;
  client_name: string | null;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  is_read: boolean;
  read_count: number;
  total_target: number;
};

export type BoardPost = {
  id: string;
  site_id: string;
  site_name: string;
  author_user_id: string;
  author_display_name: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

const STALE = 15_000;

export function useNotices() {
  return useQuery({
    queryKey: ["notices", "list"],
    queryFn: () => apiGet<{ items: Notice[] }>("/api/notices"),
    staleTime: STALE,
  });
}

export function useMarkNoticeRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noticeId: string) => apiPostEmpty(`/api/notices/${noticeId}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notices"] }),
  });
}

export type CreateNoticeInput = {
  target_type: "all" | "department" | "individual";
  target_department_id?: string | null;
  target_user_id?: string | null;
  client_id?: string | null;
  title: string;
  body: string;
};

export function useCreateNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: CreateNoticeInput) =>
      apiPost<{ item: Notice }>("/api/notices", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notices"] }),
  });
}

export function useBoardPosts(siteId?: string) {
  return useQuery({
    queryKey: ["board", "list", siteId ?? "all"],
    queryFn: () =>
      apiGet<{ items: BoardPost[] }>(
        siteId ? `/api/board?site_id=${siteId}` : "/api/board",
      ),
    staleTime: STALE,
    enabled: siteId === undefined ? true : siteId.length > 0,
  });
}

export type CreateBoardInput = {
  site_id: string;
  title: string;
  body: string;
  pinned?: boolean;
};

export function useCreateBoardPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: CreateBoardInput) =>
      apiPost<{ item: BoardPost }>("/api/board", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board"] }),
  });
}
