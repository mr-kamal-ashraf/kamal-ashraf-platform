import { isStage, type Stage } from "@/shared/lib/stage";
import type { RegisterFormState } from "./RegisterProvider";
import { TOTAL_STEPS } from "./config/steps";

/**
 * The register wizard's progress, kept in sessionStorage so a reload doesn't
 * send the student back to step 1 — e.g. a phone dropping the background tab
 * while they read the WhatsApp codes. Scoped to the tab, expires after
 * DRAFT_MAX_AGE_MS, and NEVER holds the password.
 */
const DRAFT_KEY = "register-draft";
const DRAFT_MAX_AGE_MS = 30 * 60 * 1000;
const VERSION = 1;

export type DraftForm = Omit<RegisterFormState, "password" | "confirmPassword">;

export interface RegisterDraft {
  step: number;
  stage: Stage;
  form: DraftForm;
}

const FORM_KEYS: (keyof DraftForm)[] = [
  "firstName",
  "secondName",
  "thirdName",
  "studentPhone",
  "parentPhone",
  "studentVerificationCode",
  "parentVerificationCode",
];

export function readRegisterDraft(): RegisterDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    const form = saved.form as Record<string, unknown> | undefined;
    const fresh =
      saved.v === VERSION &&
      typeof saved.savedAt === "number" &&
      Date.now() - saved.savedAt < DRAFT_MAX_AGE_MS;
    const valid =
      Number.isInteger(saved.step) &&
      (saved.step as number) >= 0 &&
      (saved.step as number) < TOTAL_STEPS &&
      isStage(saved.stage) &&
      !!form &&
      FORM_KEYS.every((key) => typeof form[key] === "string");
    if (!fresh || !valid) {
      clearRegisterDraft();
      return null;
    }
    return {
      step: saved.step as number,
      stage: saved.stage as Stage,
      form: Object.fromEntries(
        FORM_KEYS.map((key) => [key, form[key]]),
      ) as DraftForm,
    };
  } catch {
    return null;
  }
}

export function writeRegisterDraft(
  step: number,
  stage: Stage,
  form: RegisterFormState,
): void {
  try {
    const safeForm = Object.fromEntries(
      FORM_KEYS.map((key) => [key, form[key]]),
    ) as DraftForm;
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        v: VERSION,
        savedAt: Date.now(),
        step,
        stage,
        form: safeForm,
      }),
    );
  } catch {
    // Private mode / storage full: the wizard just works without the safety net.
  }
}

export function clearRegisterDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
