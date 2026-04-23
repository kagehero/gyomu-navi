import { RequireAuth, RoleBasedLayout } from "@/components/layout";

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RoleBasedLayout>{children}</RoleBasedLayout>
    </RequireAuth>
  );
}
