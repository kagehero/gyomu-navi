/** When true, only the dashboard is exposed; other app routes are redirected and nav items hidden. */
export function isDashboardOnlyRelease(): boolean {
  if (process.env.DASHBOARD_ONLY === "true") return true;
  if (process.env.NEXT_PUBLIC_DASHBOARD_ONLY === "true") return true;
  return false;
}

/** Routes hidden when {@link isDashboardOnlyRelease} is on (not including `/`). */
export const DASHBOARD_ONLY_HIDDEN_PREFIXES = [
  "/reports",
  "/attendance",
  "/notices",
  "/master",
  "/settings",
] as const;
