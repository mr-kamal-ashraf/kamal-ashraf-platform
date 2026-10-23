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
import { adminAuthApi, isApiError } from "@/api";
import type { Admin } from "@/api/types";

interface AdminAuthContextValue {
  admin: Admin | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<Admin>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(
  undefined,
);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await adminAuthApi.me();
      setAdmin(result.admin);
    } catch (err) {
      if (isApiError(err)) {
        setAdmin(null);
      } else {
        setAdmin(null);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await adminAuthApi.me();
        if (!cancelled) setAdmin(result.admin);
      } catch {
        if (!cancelled) setAdmin(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await adminAuthApi.login({ email, password });
    setAdmin(result.admin);
    return result.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminAuthApi.logout();
    } finally {
      setAdmin(null);
    }
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      admin,
      isLoading,
      isAuthenticated: !!admin,
      login,
      logout,
      refresh,
    }),
    [admin, isLoading, login, logout, refresh],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return ctx;
}
