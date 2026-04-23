"use client";

import { useAuth } from "@/features/auth/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmployeeAppLayout } from "@/components/layout/EmployeeAppLayout";

/** Rendered only after RequireAuth (user is set). */
export function RoleBasedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user!.role === "employee") {
    return <EmployeeAppLayout>{children}</EmployeeAppLayout>;
  }
  return <AppLayout>{children}</AppLayout>;
}
