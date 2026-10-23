import type { ReactNode } from "react";
import { AdminAuthProvider } from "@/features/admin/auth/AdminAuthContext";
import { AdminGate } from "@/features/admin/auth/AdminGate";
import { AdminShell } from "@/features/admin/shell/AdminShell";
import { ConfirmProvider } from "@/features/admin/shared/confirm/ConfirmProvider";

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminGate>
        <ConfirmProvider>
          <AdminShell>{children}</AdminShell>
        </ConfirmProvider>
      </AdminGate>
    </AdminAuthProvider>
  );
}
