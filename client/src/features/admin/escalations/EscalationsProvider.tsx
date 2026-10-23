"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { adminEscalationsApi, isApiError } from "@/api";
import type { EscalationsResult } from "@/api/admin/escalations";

type StatusFilter = "open" | "resolved" | "all";

interface EscalationsContextValue {
  data: EscalationsResult | null;
  isLoading: boolean;
  error: string | null;
  page: number;
  status: StatusFilter;
  resolvingId: string | null;
  setPage: (v: number) => void;
  setStatus: (s: StatusFilter) => void;
  resolve: (id: string) => Promise<void>;
}

const EscalationsContext = createContext<EscalationsContextValue | undefined>(
  undefined,
);

export function EscalationsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<EscalationsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatusState] = useState<StatusFilter>("open");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const result = await adminEscalationsApi.list({ status, page, limit: 20 });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(isApiError(err) ? err.message : "حصل خطأ");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, page, reloadKey]);

  const setStatus = useCallback((s: StatusFilter) => {
    setStatusState(s);
    setPage(1);
  }, []);

  const resolve = useCallback(async (id: string) => {
    setResolvingId(id);
    try {
      await adminEscalationsApi.resolve(id);
      toast.success("تم وضع التصعيد كمُحلّ");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ أثناء التحديث");
    } finally {
      setResolvingId(null);
    }
  }, []);

  const value = useMemo<EscalationsContextValue>(
    () => ({
      data,
      isLoading,
      error,
      page,
      status,
      resolvingId,
      setPage,
      setStatus,
      resolve,
    }),
    [data, isLoading, error, page, status, resolvingId, setStatus, resolve],
  );

  return (
    <EscalationsContext.Provider value={value}>
      {children}
    </EscalationsContext.Provider>
  );
}

export function useEscalations() {
  const ctx = useContext(EscalationsContext);
  if (!ctx)
    throw new Error("useEscalations must be used within EscalationsProvider");
  return ctx;
}
