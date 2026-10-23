"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildQuerySuffix } from "@/shared/lib/query";

/** How long to wait before writing filter changes into the URL. */
const URL_WRITE_DELAY_MS = 300;

/**
 * Keeps a set of list filters and the page's query string in sync.
 *
 * Three behaviours, and each one is there for a reason:
 *
 *  1. SEEDS from the URL, so a dashboard card can link straight into a filtered
 *     view ("/admin/students?status=active").
 *  2. WRITES changes back, so the view is bookmarkable and shareable. The write
 *     is debounced, which keeps a text field from pushing a URL per keystroke.
 *  3. ADOPTS the URL again when navigation comes from outside — the sidebar link
 *     back to the unfiltered list, or the browser's back button. Next.js does
 *     not remount a page on a query-only change, so without this the old filter
 *     would stay stuck on screen.
 *
 * Step 3 needs to tell an external navigation apart from the hook's own write
 * echoing back, which is what `lastWritten` records.
 *
 * `parse` is called with the query string and must return the filters it
 * describes, falling back to "" for anything missing or invalid — see
 * readEnumParam / readTextParam.
 */
export function useQueryFilters<T extends Record<string, string>>(
  parse: (params: URLSearchParams) => T,
): {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  resetFilters: () => void;
  /** True when at least one filter is active — for a "clear filters" button. */
  hasFilters: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Held in a ref so an inline parse function does not re-trigger the effects.
  const parseRef = useRef(parse);
  parseRef.current = parse;

  const [filters, setFilters] = useState<T>(() =>
    parse(new URLSearchParams(searchParams.toString())),
  );

  const lastWritten = useRef<string>(searchParams.toString());

  // (3) External navigation wins over the current selection.
  useEffect(() => {
    const current = searchParams.toString();
    if (current === lastWritten.current) return;
    lastWritten.current = current;
    setFilters(parseRef.current(new URLSearchParams(current)));
  }, [searchParams]);

  // (2) Mirror the selection into the URL.
  useEffect(() => {
    const suffix = buildQuerySuffix(filters);
    const next = suffix.startsWith("?") ? suffix.slice(1) : "";
    if (next === lastWritten.current) return;

    const timer = setTimeout(() => {
      lastWritten.current = next;
      router.replace(`${pathname}${suffix}`, { scroll: false });
    }, URL_WRITE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [filters, pathname, router]);

  const setFilter = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setFilters((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters((prev) => {
      const cleared = { ...prev };
      for (const key of Object.keys(cleared) as (keyof T)[]) {
        cleared[key] = "" as T[keyof T];
      }
      return cleared;
    });
  }, []);

  const hasFilters = Object.values(filters).some((value) => value !== "");

  return { filters, setFilter, resetFilters, hasFilters };
}
