"use client";

import { createContext, useContext, type ReactNode } from "react";

type Value = { dashboardOnly: boolean };

const ReleaseModeContext = createContext<Value>({ dashboardOnly: false });

export function ReleaseModeProvider({
  dashboardOnly,
  children,
}: {
  dashboardOnly: boolean;
  children: ReactNode;
}) {
  return <ReleaseModeContext.Provider value={{ dashboardOnly }}>{children}</ReleaseModeContext.Provider>;
}

export function useReleaseMode() {
  return useContext(ReleaseModeContext);
}
