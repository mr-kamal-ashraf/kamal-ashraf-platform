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
import type { Stage } from "@/api/types";
import { useAuth } from "@/features/auth/AuthContext";
import { REGISTER_STEPS, TOTAL_STEPS } from "./config/steps";
import { DEFAULT_STAGE } from "@/shared/lib/stage";
import {
  clearRegisterDraft,
  readRegisterDraft,
  writeRegisterDraft,
} from "./registerDraft";

export interface RegisterFormState {
  firstName: string;
  secondName: string;
  thirdName: string;
  studentPhone: string;
  parentPhone: string;
  password: string;
  confirmPassword: string;
  studentVerificationCode: string;
  parentVerificationCode: string;
}

const INITIAL: RegisterFormState = {
  firstName: "",
  secondName: "",
  thirdName: "",
  studentPhone: "",
  parentPhone: "",
  password: "",
  confirmPassword: "",
  studentVerificationCode: "",
  parentVerificationCode: "",
};

// Egyptian mobile: 11 digits starting with 01.
const EG_PHONE = /^01[0-25]\d{8}$/;
const VALID_NAME = /^[\u0600-\u06FFa-zA-Z\s]+$/;

function validateName(value: string, label: string): string | null {
  const name = value.trim();
  if (!name) return `${label} مطلوب.`;
  if (name.length < 2) return `${label} لازم يكون حرفين على الأقل.`;
  if (name.length > 50) return `${label} طويل جدًا.`;
  if (!VALID_NAME.test(name)) return `${label} لازم يحتوي على حروف فقط.`;
  return null;
}

/** Validates the fields that belong to a given step. Returns an Arabic error
 *  message to show, or null when the step is complete and valid. */
function validateStep(step: number, form: RegisterFormState): string | null {
  switch (step) {
    case 0:
      return (
        validateName(form.firstName, "الاسم الأول") ??
        validateName(form.secondName, "اسم الأب") ??
        validateName(form.thirdName, "اسم الجد")
      );
    case 1:
      if (!EG_PHONE.test(form.studentPhone.trim())) {
        return "رقم موبايل الطالب لازم يكون ١١ رقم ويبدأ بـ 01.";
      }
      if (!EG_PHONE.test(form.parentPhone.trim())) {
        return "رقم موبايل ولي الأمر لازم يكون ١١ رقم ويبدأ بـ 01.";
      }
      if (form.studentPhone.trim() === form.parentPhone.trim()) {
        return "رقم الطالب لازم يكون مختلف عن رقم ولي الأمر.";
      }
      return null;
    case 2:
      if (!/^\d{6}$/.test(form.studentVerificationCode.trim())) {
        return "اكتب كود الطالب المكوّن من 6 أرقام.";
      }
      if (!/^\d{6}$/.test(form.parentVerificationCode.trim())) {
        return "اكتب كود ولي الأمر المكوّن من 6 أرقام.";
      }
      return null;
    case 4:
      if (form.password.length < 8) {
        return "كلمة السر لازم تكون 8 حروف أو أكتر.";
      }
      if (form.password.length > 128) {
        return "كلمة السر طويلة جدًا.";
      }
      if (!/[A-Za-z]/.test(form.password)) {
        return "كلمة السر لازم تحتوي على حرف إنجليزي واحد على الأقل.";
      }
      if (!/\d/.test(form.password)) {
        return "كلمة السر لازم تحتوي على رقم واحد على الأقل.";
      }
      if (form.password !== form.confirmPassword) {
        return "كلمة السر وتأكيدها مش متطابقين.";
      }
      return null;
    default:
      return null;
  }
}

interface RegisterContextValue {
  form: RegisterFormState;
  stage: Stage;
  showPwd: boolean;
  showPwd2: boolean;
  loading: boolean;
  error: string | null;
  step: number;
  totalSteps: number;
  steps: readonly { title: string }[];
  isLastStep: boolean;
  resendSeconds: number;
  update: (
    key: keyof RegisterFormState,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  setStage: (s: Stage) => void;
  toggleShowPwd: () => void;
  toggleShowPwd2: () => void;
  next: () => Promise<void>;
  back: () => void;
  resendCodes: () => Promise<void>;
  onSubmit: (e: React.FormEvent) => void;
}

const RegisterContext = createContext<RegisterContextValue | undefined>(
  undefined,
);

export function RegisterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();

  const [form, setForm] = useState<RegisterFormState>(INITIAL);
  const [stage, setStage] = useState<Stage>(DEFAULT_STAGE);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  // False until a saved draft (if any) is restored, so the first save can't
  // overwrite it with the empty initial form.
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, router]);

  // Restore after mount (sessionStorage doesn't exist during SSR).
  useEffect(() => {
    const draft = readRegisterDraft();
    if (draft) {
      setForm((current) => ({ ...current, ...draft.form }));
      setStage(draft.stage);
      setStep(draft.step);
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (draftReady) writeRegisterDraft(step, stage, form);
  }, [draftReady, step, stage, form]);

  const update = useCallback(
    (key: keyof RegisterFormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
        setError(null);
      },
    [],
  );

  const toggleShowPwd = useCallback(() => setShowPwd((v) => !v), []);
  const toggleShowPwd2 = useCallback(() => setShowPwd2((v) => !v), []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const requestCodes = useCallback(
    async (advanceToVerification: boolean) => {
      const err = validateStep(1, form);
      if (err) {
        setError(err);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await authApi.sendRegistrationCodes(
          form.studentPhone.trim(),
          form.parentPhone.trim(),
        );
        setForm((current) => ({
          ...current,
          studentVerificationCode: "",
          parentVerificationCode: "",
        }));
        setResendSeconds(result.resendAfterSeconds);
        if (advanceToVerification) setStep(2);
        toast.success("تم إرسال كود للطالب وكود لولي الأمر على واتساب.");
      } catch (err) {
        setError(
          isApiError(err)
            ? err.message
            : "حصل خطأ أثناء إرسال الأكواد، حاول تاني.",
        );
      } finally {
        setLoading(false);
      }
    },
    [form],
  );

  const next = useCallback(async () => {
    const err = validateStep(step, form);
    if (err) {
      setError(err);
      return;
    }
    if (step === 1) {
      await requestCodes(true);
      return;
    }
    if (step === 2) {
      setLoading(true);
      setError(null);
      try {
        await authApi.verifyRegistrationCodes({
          studentPhone: form.studentPhone.trim(),
          parentPhone: form.parentPhone.trim(),
          studentVerificationCode: form.studentVerificationCode.trim(),
          parentVerificationCode: form.parentVerificationCode.trim(),
        });
        setStep(3);
      } catch (err) {
        setError(
          isApiError(err)
            ? err.message
            : "حصل خطأ أثناء تأكيد الكودين، حاول تاني.",
        );
      } finally {
        setLoading(false);
      }
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, [step, form, requestCodes]);

  const back = useCallback(() => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const submit = useCallback(async () => {
    const err = validateStep(TOTAL_STEPS - 1, form);
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await register({
        firstName: form.firstName.trim(),
        secondName: form.secondName.trim(),
        thirdName: form.thirdName.trim(),
        studentPhone: form.studentPhone.trim(),
        parentPhone: form.parentPhone.trim(),
        password: form.password,
        stage,
        studentVerificationCode: form.studentVerificationCode.trim(),
        parentVerificationCode: form.parentVerificationCode.trim(),
      });
      clearRegisterDraft();
      toast.success(
        "تم إنشاء حسابك بنجاح! دلوقتي تقدر تتصفّح الكورسات وتشتري اللي يناسبك وتبدأ تذاكر على طول.",
      );
      router.push("/");
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError("حصل خطأ أثناء التسجيل، حاول تاني");
      }
    } finally {
      setLoading(false);
    }
  }, [form, register, router, stage]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      if (step === TOTAL_STEPS - 1) {
        void submit();
      } else {
        void next();
      }
    },
    [loading, step, submit, next],
  );

  const value = useMemo<RegisterContextValue>(
    () => ({
      form,
      stage,
      showPwd,
      showPwd2,
      loading,
      error,
      step,
      totalSteps: TOTAL_STEPS,
      steps: REGISTER_STEPS,
      isLastStep: step === TOTAL_STEPS - 1,
      resendSeconds,
      update,
      setStage,
      toggleShowPwd,
      toggleShowPwd2,
      next,
      back,
      resendCodes: () => requestCodes(false),
      onSubmit,
    }),
    [
      form,
      stage,
      showPwd,
      showPwd2,
      loading,
      error,
      step,
      resendSeconds,
      update,
      toggleShowPwd,
      toggleShowPwd2,
      next,
      back,
      onSubmit,
      requestCodes,
    ],
  );

  return (
    <RegisterContext.Provider value={value}>
      {children}
    </RegisterContext.Provider>
  );
}

export function useRegister() {
  const ctx = useContext(RegisterContext);
  if (!ctx) throw new Error("useRegister must be used within RegisterProvider");
  return ctx;
}
