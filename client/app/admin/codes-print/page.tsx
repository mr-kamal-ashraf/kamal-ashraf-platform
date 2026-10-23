"use client";

import { Suspense } from "react";
import { AdminAuthProvider } from "@/features/admin/auth/AdminAuthContext";
import { AdminGate } from "@/features/admin/auth/AdminGate";
import { CodesPrintView } from "@/features/admin/courses/codes-print/CodesPrintView";

/** Course-code print sheet — outside the panel shell so only the cards print. */
export default function CodesPrintPage() {
  return (
    <AdminAuthProvider>
      <AdminGate>
        <Suspense>
          <CodesPrintView />
        </Suspense>
      </AdminGate>
    </AdminAuthProvider>
  );
}
