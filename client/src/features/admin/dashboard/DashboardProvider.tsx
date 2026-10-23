"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { adminDashboardApi } from "@/api";
import type { DashboardStats } from "@/api/types";
import { useApiQuery } from "@/shared/hooks/useApiQuery";

interface DashboardContextValue {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(
  undefined,
);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useApiQuery(
    () => adminDashboardApi.stats(),
    [],
  );

  const value = useMemo<DashboardContextValue>(
    () => ({
      stats: data ?? null,
      isLoading,
      error,
    }),
    [data, isLoading, error],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
