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
import { authApi, isApiError } from "@/api";
import type { LoginPayload, RegisterPayload } from "@/api/auth";
import type { MeResponse, User } from "@/api/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyMe = useCallback((data: MeResponse | null) => {
    if (!data) {
      setUser(null);
      return;
    }
    setUser(data.user);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      applyMe(me);
    } catch (err) {
      if (isApiError(err) && err.statusCode === 401) {
        applyMe(null);
      } else {
        applyMe(null);
      }
    }
  }, [applyMe]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await authApi.me();
        if (!cancelled) applyMe(me);
      } catch {
        if (!cancelled) applyMe(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyMe]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const result = await authApi.login(payload);
      const me = await authApi.me();
      applyMe(me);
      return result.user;
    },
    [applyMe],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const result = await authApi.register(payload);
      // Backend now auto-issues auth cookies on register,
      // so we can load the user profile immediately.
      const me = await authApi.me();
      applyMe(me);
      return result.user;
    },
    [applyMe],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      applyMe(null);
    }
  }, [applyMe]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refresh,
    }),
    [
      user,
      isLoading,
      login,
      register,
      logout,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
