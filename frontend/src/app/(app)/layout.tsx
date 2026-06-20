import { ReleaseModeProvider, RequireAuth, RoleBasedLayout } from "@/components/layout";
import { isDashboardOnlyRelease } from "@/lib/releaseMode";

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  const dashboardOnly = isDashboardOnlyRelease();
  return (
    <RequireAuth>
      <ReleaseModeProvider dashboardOnly={dashboardOnly}>
        <RoleBasedLayout>{children}</RoleBasedLayout>
      </ReleaseModeProvider>
    </RequireAuth>
  );
}
