"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPostEmpty } from "@/lib/api";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "employee";
  staffId: string | null;
};

function normalizeUser(u: AuthUser): AuthUser {
  return {
    ...u,
    role: u.role ?? "admin",
    staffId: u.staffId ?? null,
  };
}

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet<{ user: AuthUser | null }>("/api/auth/me");
      setUser(data.user ? normalizeUser(data.user) : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await refresh();
      setIsLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost<{ user: AuthUser }>("/api/auth/login", {
      email,
      password,
    });
    setUser(normalizeUser(data.user));
  }, []);

  const logout = useCallback(async () => {
    await apiPostEmpty("/api/auth/logout");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      logout,
      refresh,
    }),
    [user, isLoading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
