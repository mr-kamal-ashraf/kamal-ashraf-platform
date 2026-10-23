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
import { authApi, isApiError } from "@/api";
import { useAuth } from "@/features/auth/AuthContext";

interface ProfileContextValue {
  authReady: boolean;
  passwords: {
    current: string;
    next: string;
    confirm: string;
  };
  setCurrent: (v: string) => void;
  setNext: (v: string) => void;
  setConfirm: (v: string) => void;
  submitting: boolean;
  changePassword: (e: React.FormEvent) => Promise<void>;
  logoutAndGoHome: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, logout, user } = useAuth();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const changePassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      if (next !== confirm) {
        toast.error("كلمة السر الجديدة وتأكيدها مش متطابقين");
        return;
      }
      if (next.length < 6) {
        toast.error("كلمة السر لازم 6 حروف على الأقل");
        return;
      }

      setSubmitting(true);
      try {
        await authApi.changePassword(current, next);
        toast.success("تم تغيير كلمة السر");
        setCurrent("");
        setNext("");
        setConfirm("");
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      } finally {
        setSubmitting(false);
      }
    },
    [current, next, confirm, submitting],
  );

  const logoutAndGoHome = useCallback(async () => {
    await logout();
    router.push("/");
  }, [logout, router]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      authReady: !isLoading && !!user,
      passwords: { current, next, confirm },
      setCurrent,
      setNext,
      setConfirm,
      submitting,
      changePassword,
      logoutAndGoHome,
    }),
    [
      isLoading,
      user,
      current,
      next,
      confirm,
      submitting,
      changePassword,
      logoutAndGoHome,
    ],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
