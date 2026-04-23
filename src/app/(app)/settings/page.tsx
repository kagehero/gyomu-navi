import { AdminOnlyRoute } from "@/components/layout";
import SettingsPage from "@/features/settings/SettingsPage";

export default function Page() {
  return (
    <AdminOnlyRoute>
      <SettingsPage />
    </AdminOnlyRoute>
  );
}
