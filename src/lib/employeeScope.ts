import type { AuthUser } from "@/features/auth/AuthContext";
import {
  type BoardPost,
  type Notice,
  type Staff,
  notices,
  boardPosts,
  sites,
  staffs,
} from "@/lib/mockData";

export function isAdmin(user: AuthUser | null | undefined) {
  return user?.role === "admin";
}

export function isEmployeeUser(user: AuthUser | null | undefined) {
  return user?.role === "employee";
}

export function resolveStaffProfile(user: AuthUser | null | undefined): Staff | undefined {
  if (!user?.staffId) return undefined;
  return staffs.find((s) => s.id === user.staffId);
}

/** 配属現場に紐づく子会社（顧客）ID */
export function clientIdsForStaff(staff: Staff): string[] {
  const set = new Set<string>();
  for (const siteId of staff.siteIds) {
    const c = sites.find((s) => s.id === siteId)?.clientId;
    if (c) set.add(c);
  }
  return [...set];
}

function noticeVisibleToStaff(n: Notice, staff: Staff): boolean {
  const clients = new Set(clientIdsForStaff(staff));
  if (n.clientId && !clients.has(n.clientId)) return false;
  if (n.targetType === "all") return true;
  if (n.targetType === "department") return n.targetId === staff.departmentId;
  if (n.targetType === "individual") return n.targetId === staff.id;
  return false;
}

export function filterNoticesForEmployee(staff: Staff): Notice[] {
  return notices
    .filter((n) => noticeVisibleToStaff(n, staff))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function filterBoardForEmployee(staff: Staff): BoardPost[] {
  return boardPosts
    .filter((p) => staff.siteIds.includes(p.siteId))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}
