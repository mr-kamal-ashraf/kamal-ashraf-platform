"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "./AdminAuthContext";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { admin, isLoading } = useAdminAuth();

  useEffect(() => {
    if (!isLoading && !admin) {
      router.replace("/admin/login");
    }
  }, [isLoading, admin, router]);

  if (isLoading) return <LoadingScreen variant="page" delayed />;

  if (!admin) return null;

  return <>{children}</>;
}
