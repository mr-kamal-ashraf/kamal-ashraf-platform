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
import { isApiError } from "@/api";
import { useAuth } from "@/features/auth/AuthContext";

interface LoginContextValue {
  studentPhone: string;
  password: string;
  showPwd: boolean;
  loading: boolean;
  setStudentPhone: (v: string) => void;
  setPassword: (v: string) => void;
  toggleShowPwd: () => void;
  submit: (e: React.FormEvent) => Promise<void>;
}

const LoginContext = createContext<LoginContextValue | undefined>(undefined);

export function LoginProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [studentPhone, setStudentPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, router]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      setLoading(true);
      try {
        await login({ studentPhone: studentPhone.trim(), password });
        toast.success("تم تسجيل الدخول بنجاح");
        router.push("/");
      } catch (err) {
        if (isApiError(err)) {
          toast.error(err.message);
        } else {
          toast.error("حصل خطأ غير متوقع، حاول تاني");
        }
      } finally {
        setLoading(false);
      }
    },
    [login, loading, password, router, studentPhone],
  );

  const value = useMemo<LoginContextValue>(
    () => ({
      studentPhone,
      password,
      showPwd,
      loading,
      setStudentPhone,
      setPassword,
      toggleShowPwd: () => setShowPwd((v) => !v),
      submit,
    }),
    [studentPhone, password, showPwd, loading, submit],
  );

  return (
    <LoginContext.Provider value={value}>{children}</LoginContext.Provider>
  );
}

export function useLogin() {
  const ctx = useContext(LoginContext);
  if (!ctx) throw new Error("useLogin must be used within LoginProvider");
  return ctx;
}
