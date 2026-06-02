import { AdminOnlyRoute } from "@/components/layout";
import MasterPage from "@/features/master/MasterPage";

export default function Page() {
  return (
    <AdminOnlyRoute>
      <MasterPage />
    </AdminOnlyRoute>
  );
}
