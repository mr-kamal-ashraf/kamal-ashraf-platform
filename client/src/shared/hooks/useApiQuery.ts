"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError } from "@/api/client";

interface UseApiQueryResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  setData: (updater: T | null | ((prev: T | null) => T | null)) => void;
}

export function useApiQuery<T>(
  fn: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
): UseApiQueryResult<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const cancelledRef = useRef(false);

  const run = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fnRef.current();
      if (cancelledRef.current) return;
      setDataState(result);
      setError(null);
    } catch (err) {
      if (cancelledRef.current) return;
      setError(isApiError(err) ? err.message : "حصل خطأ غير متوقع");
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    void run();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(async () => {
    await run();
  }, [run]);

  const setData = useCallback(
    (updater: T | null | ((prev: T | null) => T | null)) => {
      setDataState((prev) =>
        typeof updater === "function"
          ? (updater as (p: T | null) => T | null)(prev)
          : updater,
      );
    },
    [],
  );

  return { data, error, isLoading, refetch, setData };
}
