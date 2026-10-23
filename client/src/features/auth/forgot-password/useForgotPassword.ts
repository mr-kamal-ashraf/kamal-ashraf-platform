"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authApi, isApiError } from "@/api";
import { useAuth } from "@/features/auth/AuthContext";

export const FORGOT_STEPS = [
  { title: "رقم الموبايل" },
  { title: "كود التأكيد" },
  { title: "كلمة السر الجديدة" },
] as const;

// Same rules as the register form and the server's schemas.
const EG_PHONE = /^01[0-25]\d{8}$/;
const CODE = /^\d{6}$/;

function passwordError(password: string, confirm: string): string | null {
  if (password.length < 8) return "كلمة السر لازم تكون 8 حروف أو أكتر.";
  if (password.length > 128) return "كلمة السر طويلة جدًا.";
  if (!/[A-Za-z]/.test(password)) {
    return "كلمة السر لازم تحتوي على حرف إنجليزي واحد على الأقل.";
  }
  if (!/\d/.test(password)) {
    return "كلمة السر لازم تحتوي على رقم واحد على الأقل.";
  }
  if (password !== confirm) return "كلمة السر وتأكيدها مش متطابقين.";
  return null;
}

/**
 * Forgot-password wizard: phone → WhatsApp code → new password. The code is
 * checked on its own step (so a typo is caught before the password form) and
 * again, then consumed, when the new password is saved.
 */
export function useForgotPassword() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace("/");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(
      () => setResendSeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const run = useCallback(
    async (action: () => Promise<void>, fallback: string) => {
      setLoading(true);
      setError(null);
      try {
        await action();
      } catch (err) {
        setError(isApiError(err) ? err.message : fallback);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const sendCode = useCallback(
    () =>
      run(async () => {
        const result = await authApi.forgotPassword(phone.trim());
        setCode("");
        setResendSeconds(result.resendAfterSeconds);
        setStep(1);
        toast.success("بعتنالك كود على واتساب.");
      }, "حصل خطأ أثناء إرسال الكود، حاول تاني."),
    [phone, run],
  );

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      if (step === 0) {
        if (!EG_PHONE.test(phone.trim())) {
          setError("رقم الموبايل لازم يكون ١١ رقم ويبدأ بـ 01.");
          return;
        }
        void sendCode();
        return;
      }

      if (step === 1) {
        if (!CODE.test(code.trim())) {
          setError("اكتب الكود المكوّن من 6 أرقام.");
          return;
        }
        void run(async () => {
          await authApi.verifyPasswordReset(phone.trim(), code.trim());
          setStep(2);
        }, "حصل خطأ أثناء تأكيد الكود، حاول تاني.");
        return;
      }

      const invalid = passwordError(password, confirm);
      if (invalid) {
        setError(invalid);
        return;
      }
      void run(async () => {
        await authApi.resetPassword(phone.trim(), code.trim(), password);
        toast.success("تم تغيير كلمة السر. ادخل بكلمة السر الجديدة.");
        router.push("/login");
      }, "حصل خطأ أثناء تغيير كلمة السر، حاول تاني.");
    },
    [loading, step, phone, code, password, confirm, sendCode, run, router],
  );

  const edit =
    (setter: (value: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setError(null);
    };

  /** Back to the phone step (e.g. a typo in the number). */
  const changePhone = () => {
    setError(null);
    setCode("");
    setStep(0);
  };

  return {
    step,
    phone,
    code,
    password,
    confirm,
    showPwd,
    loading,
    error,
    resendSeconds,
    setPhone: edit(setPhone),
    setCode: edit(setCode),
    setPassword: edit(setPassword),
    setConfirm: edit(setConfirm),
    toggleShowPwd: () => setShowPwd((v) => !v),
    resend: sendCode,
    changePhone,
    submit,
  };
}
