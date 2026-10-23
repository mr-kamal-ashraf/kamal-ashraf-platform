"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  adminSalesApi,
  isApiError,
  type SalesFilters as SalesQuery,
  type SalesListResult,
  type SalesSummary,
  type SaleSource,
  type SaleStatus,
} from "@/api";
import type { Stage } from "@/api/types";
import { useDebounced } from "@/shared/hooks/useDebounced";
import { useQueryFilters } from "@/shared/hooks/useQueryFilters";
import { readEnumParam, readTextParam } from "@/shared/lib/query";
import { STAGE_VALUES } from "@/shared/lib/stage";

const SOURCE_VALUES = ["paymob", "cash", "code"] as const;
const STATUS_VALUES = ["active", "revoked"] as const;

export type SalesSourceFilter = "" | SaleSource;
export type SalesStatusFilter = "" | SaleStatus;

interface SalesFilterState extends Record<string, string> {
  search: string;
  source: SalesSourceFilter;
  status: SalesStatusFilter;
  stage: "" | Stage;
  /** yyyy-mm-dd, straight from the date inputs. */
  from: string;
  to: string;
}

interface SalesContextValue {
  search: string;
  source: SalesSourceFilter;
  status: SalesStatusFilter;
  stage: "" | Stage;
  from: string;
  to: string;
  page: number;
  data: SalesListResult | null;
  summary: SalesSummary | null;
  isLoading: boolean;
  error: string | null;
  exportUrl: string;
  hasFilters: boolean;
  setSearch: (v: string) => void;
  setSource: (v: SalesSourceFilter) => void;
  setStatus: (v: SalesStatusFilter) => void;
  setStage: (v: "" | Stage) => void;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  setPage: (v: number) => void;
  resetFilters: () => void;
}

const SalesContext = createContext<SalesContextValue | undefined>(undefined);

/**
 * Owns the sales report's filters and data. Filters live in the query string
 * (see useQueryFilters) so the dashboard's "مبيعات الشهر" card can link here
 * with the date range already set, and the teacher can bookmark a view.
 */
export function SalesProvider({ children }: { children: ReactNode }) {
  const { filters, setFilter, resetFilters, hasFilters } =
    useQueryFilters<SalesFilterState>((params) => ({
      search: readTextParam(params.get("search")) ?? "",
      source: readEnumParam(params.get("source"), SOURCE_VALUES) ?? "",
      status: readEnumParam(params.get("status"), STATUS_VALUES) ?? "",
      stage: readEnumParam(params.get("stage"), STAGE_VALUES) ?? "",
      from: readTextParam(params.get("from")) ?? "",
      to: readTextParam(params.get("to")) ?? "",
    }));

  const { search, source, status, stage, from, to } = filters;

  const [page, setPage] = useState(1);
  const [data, setData] = useState<SalesListResult | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search, 300);

  const query = useMemo<Omit<SalesQuery, "page" | "limit">>(
    () => ({
      search: debouncedSearch || undefined,
      source: source || undefined,
      status: status || undefined,
      stage: stage || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [debouncedSearch, source, status, stage, from, to],
  );

  useEffect(() => {
    setPage(1);
  }, [query]);

  // Platform-wide, so fetched once: the filtered total rides on the list
  // response instead of costing a second round trip per filter change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await adminSalesApi.summary();
        if (!cancelled) setSummary(result);
      } catch {
        // A failed summary must not blank the table; the cards just stay hidden.
        if (!cancelled) setSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const result = await adminSalesApi.list({ ...query, page, limit: 20 });
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(isApiError(err) ? err.message : "حصل خطأ");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, page]);

  const value = useMemo<SalesContextValue>(
    () => ({
      ...filters,
      page,
      data,
      summary,
      isLoading,
      error,
      hasFilters,
      exportUrl: adminSalesApi.exportUrl(query),
      setSearch: (v) => setFilter("search", v),
      setSource: (v) => setFilter("source", v),
      setStatus: (v) => setFilter("status", v),
      setStage: (v) => setFilter("stage", v),
      setFrom: (v) => setFilter("from", v),
      setTo: (v) => setFilter("to", v),
      setPage,
      resetFilters,
    }),
    [
      filters,
      page,
      data,
      summary,
      isLoading,
      error,
      hasFilters,
      query,
      setFilter,
      resetFilters,
    ],
  );

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSales() {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error("useSales must be used within SalesProvider");
  return ctx;
}
