"use client";

import { useAuth } from "@/features/auth/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "employee") {
      router.replace("/");
    }
  }, [user, router]);

  if (user?.role === "employee") {
    return null;
  }

  return <>{children}</>;
}
