import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import EmployeeRegisterPage from "@/features/auth/EmployeeRegisterPage";

function RegisterFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <EmployeeRegisterPage />
    </Suspense>
  );
}
