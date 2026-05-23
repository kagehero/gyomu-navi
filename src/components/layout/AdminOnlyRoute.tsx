"use client";

import { useAuth } from "@/features/auth/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Strictly admin-only. Manager and employee both get redirected to /.
 * The matching API endpoints already 403 non-admins; this avoids users
 * landing on a page that will only show errors.
 */
export function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const notAdmin = user !== null && user.role !== "admin";

  useEffect(() => {
    if (notAdmin) {
      router.replace("/");
    }
  }, [notAdmin, router]);

  if (notAdmin) {
    return null;
  }

  return <>{children}</>;
}
