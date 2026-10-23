"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { adminAuditLogsApi, isApiError } from "@/api";
import type { AuditLogEntry, PaginatedResult } from "@/api/types";

interface AuditLogsContextValue {
  data: PaginatedResult<AuditLogEntry> | null;
  isLoading: boolean;
  error: string | null;
  page: number;
  setPage: (v: number) => void;
}

const AuditLogsContext = createContext<AuditLogsContextValue | undefined>(
  undefined,
);

export function AuditLogsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PaginatedResult<AuditLogEntry> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const result = await adminAuditLogsApi.list({ page, limit: 30 });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(isApiError(err) ? err.message : "حصل خطأ");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const value = useMemo<AuditLogsContextValue>(
    () => ({ data, isLoading, error, page, setPage }),
    [data, isLoading, error, page],
  );

  return (
    <AuditLogsContext.Provider value={value}>
      {children}
    </AuditLogsContext.Provider>
  );
}

export function useAuditLogs() {
  const ctx = useContext(AuditLogsContext);
  if (!ctx) throw new Error("useAuditLogs must be used within AuditLogsProvider");
  return ctx;
}
