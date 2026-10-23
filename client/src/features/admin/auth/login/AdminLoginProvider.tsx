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
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminAuthApi, isApiError } from "@/api";

interface AdminLoginContextValue {
  email: string;
  password: string;
  showPwd: boolean;
  loading: boolean;
  checking: boolean;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  toggleShowPwd: () => void;
  submit: (e: React.FormEvent) => Promise<void>;
}

const AdminLoginContext = createContext<AdminLoginContextValue | undefined>(
  undefined,
);

export function AdminLoginProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await adminAuthApi.me();
        if (!cancelled) router.replace("/admin/dashboard");
      } catch {
        // not authenticated, stay on login
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      setLoading(true);
      try {
        await adminAuthApi.login({
          email: email.trim().toLowerCase(),
          password,
        });
        toast.success("تم تسجيل الدخول");
        router.push("/admin/dashboard");
      } catch (err) {
        if (isApiError(err)) {
          toast.error(err.message);
        } else {
          toast.error("حصل خطأ غير متوقع");
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, loading, router],
  );

  const value = useMemo<AdminLoginContextValue>(
    () => ({
      email,
      password,
      showPwd,
      loading,
      checking,
      setEmail,
      setPassword,
      toggleShowPwd: () => setShowPwd((v) => !v),
      submit,
    }),
    [email, password, showPwd, loading, checking, submit],
  );

  return (
    <AdminLoginContext.Provider value={value}>
      {children}
    </AdminLoginContext.Provider>
  );
}

export function useAdminLogin() {
  const ctx = useContext(AdminLoginContext);
  if (!ctx) throw new Error("useAdminLogin must be used within AdminLoginProvider");
  return ctx;
}
