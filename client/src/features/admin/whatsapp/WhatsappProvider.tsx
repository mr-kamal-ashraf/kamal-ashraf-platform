"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { adminWhatsappApi, isApiError } from "@/api";
import type {
  WhatsappStatus,
  WhatsappStatusResult,
} from "@/api/admin/whatsapp";

interface WhatsappContextValue {
  status: WhatsappStatus | null;
  phone: string | null;
  since: string | null;
  lastError: string | null;
  qr: string | null;
  isLoading: boolean; // first load only
  error: string | null;
  busy: null | "logout" | "restart";
  aiRepliesEnabled: boolean;
  aiBusy: boolean;
  logout: () => Promise<void>;
  restart: () => Promise<void>;
  setAiReplies: (enabled: boolean) => Promise<void>;
}

const WhatsappContext = createContext<WhatsappContextValue | undefined>(
  undefined,
);

export function WhatsappProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<WhatsappStatusResult | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "logout" | "restart">(null);
  const busyRef = useRef<null | "logout" | "restart">(null);
  const [aiBusy, setAiBusy] = useState(false);
  const aiBusyRef = useRef(false);

  // One refresh = status, plus the QR image while we're waiting to be linked.
  const refresh = useCallback(async () => {
    // Don't poll over an in-flight logout/restart/switch (its own call refreshes).
    if (busyRef.current || aiBusyRef.current) return;
    try {
      const st = await adminWhatsappApi.status();
      setInfo(st);
      setError(null);
      if (st.status === "qr") {
        try {
          const q = await adminWhatsappApi.qr();
          setQr(q.qr);
        } catch {
          /* keep the last QR */
        }
      } else {
        setQr(null);
      }
    } catch (err) {
      setError(isApiError(err) ? err.message : "تعذّر جلب حالة الواتساب");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
    };
    void tick();
    // Poll while the page is open so the QR / connection state stays live.
    const id = setInterval(tick, 3500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh]);

  const runAction = useCallback(
    async (action: "logout" | "restart") => {
      setBusy(action);
      busyRef.current = action;
      try {
        const res =
          action === "logout"
            ? await adminWhatsappApi.logout()
            : await adminWhatsappApi.restart();
        setInfo(res);
        toast.success(
          action === "logout"
            ? "تم فصل الرقم — امسح الكود الجديد لإعادة الربط"
            : "تمت إعادة تشغيل الاتصال",
        );
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ، جرّب تاني");
      } finally {
        setBusy(null);
        busyRef.current = null;
        void refresh();
      }
    },
    [refresh],
  );

  const logout = useCallback(() => runAction("logout"), [runAction]);
  const restart = useCallback(() => runAction("restart"), [runAction]);

  // Optimistic: flip the switch immediately, roll back if the server refuses.
  const setAiReplies = useCallback(
    async (enabled: boolean) => {
      if (aiBusyRef.current) return;
      aiBusyRef.current = true;
      setAiBusy(true);
      setInfo((prev) => (prev ? { ...prev, aiRepliesEnabled: enabled } : prev));
      try {
        const res = await adminWhatsappApi.setAiReplies(enabled);
        setInfo(res);
        toast.success(
          enabled ? "تم تشغيل رد الذكاء الاصطناعي" : "تم إيقاف رد الذكاء الاصطناعي",
        );
      } catch (err) {
        setInfo((prev) => (prev ? { ...prev, aiRepliesEnabled: !enabled } : prev));
        toast.error(isApiError(err) ? err.message : "حصل خطأ، جرّب تاني");
      } finally {
        aiBusyRef.current = false;
        setAiBusy(false);
      }
    },
    [],
  );

  const value = useMemo<WhatsappContextValue>(
    () => ({
      status: info?.status ?? null,
      phone: info?.phone ?? null,
      since: info?.since ?? null,
      lastError: info?.lastError ?? null,
      qr,
      isLoading,
      error,
      busy,
      aiRepliesEnabled: info?.aiRepliesEnabled ?? true,
      aiBusy,
      logout,
      restart,
      setAiReplies,
    }),
    [info, qr, isLoading, error, busy, aiBusy, logout, restart, setAiReplies],
  );

  return (
    <WhatsappContext.Provider value={value}>
      {children}
    </WhatsappContext.Provider>
  );
}

export function useWhatsapp() {
  const ctx = useContext(WhatsappContext);
  if (!ctx) throw new Error("useWhatsapp must be used within WhatsappProvider");
  return ctx;
}
