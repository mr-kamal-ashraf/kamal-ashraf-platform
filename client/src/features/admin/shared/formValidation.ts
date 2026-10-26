import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { isApiError } from "@/api";

/*
 * Checks for the course / lesson forms. The rules mirror the server's
 * (course.validation.ts / lesson.validation.ts), so a mistake shows under its
 * field before saving — not as a failed save.
 */

/** Field → message; a field without a message is fine. */
export type FieldErrors = Partial<Record<string, string>>;

const SLUG = /^[a-z0-9-]+$/;
const length = (v: string) => v.trim().length;

export const SLUG_TAKEN_MESSAGE = "الرابط ده مستخدم قبل كده — اختار رابط تاني.";

/** Each rule returns the problem in the teacher's words, or null when it's fine. */
export const contentRules = {
  title(value: string, noun: "الكورس" | "الدرس") {
    if (!length(value)) return `اكتب عنوان ${noun}.`;
    if (length(value) < 3) return "العنوان لازم يكون ٣ حروف على الأقل.";
    if (length(value) > 200) return "العنوان طويل — أقصى حد ٢٠٠ حرف.";
    return null;
  },
  slug(value: string) {
    if (!length(value)) return "اكتب الرابط — مثلاً: nahw-term-1.";
    if (!SLUG.test(value.trim())) {
      return "الرابط بالحروف الإنجليزي الصغيرة والأرقام والشَرطة (-) بس، من غير مسافات أو حروف عربي.";
    }
    return null;
  },
  description(value: string) {
    if (!length(value)) return "اكتب وصف قصير.";
    if (length(value) < 10) return "الوصف القصير لازم يكون ١٠ حروف على الأقل.";
    if (length(value) > 500) return "الوصف القصير طويل — أقصى حد ٥٠٠ حرف.";
    return null;
  },
  /** Optional: empty is fine (the short description stands in for it). */
  optionalLongDescription(value: string) {
    if (!length(value)) return null;
    if (length(value) < 10) return "الوصف التفصيلي لازم يكون ١٠ حروف على الأقل — أو سيبه فاضي.";
    if (length(value) > 5000) return "الوصف التفصيلي طويل — أقصى حد ٥٠٠٠ حرف.";
    return null;
  },
  price(value: number) {
    if (!Number.isFinite(value) || value < 0) return "السعر لازم يكون صفر أو أكتر.";
    if (value > 100_000) return "السعر كبير — أقصى حد ١٠٠٬٠٠٠ جنيه.";
    return null;
  },
  durationMinutes(value: number) {
    if (!Number.isInteger(value) || value < 1) return "المدة لازم تكون دقيقة واحدة على الأقل.";
    if (value > 1000) return "أقصى مدة ١٠٠٠ دقيقة.";
    return null;
  },
  chapters(value: number) {
    if (!Number.isInteger(value) || value < 1) return "لازم فصل واحد على الأقل.";
    if (value > 50) return "أقصى عدد ٥٠ فصل.";
    return null;
  },
  topics(value: string[]) {
    const filled = value.map((t) => t.trim()).filter(Boolean);
    if (filled.length > 20) return "أقصى عدد ٢٠ محور.";
    if (filled.some((t) => t.length > 100)) return "كل محور أقصى حد ١٠٠ حرف.";
    return null;
  },
};

export const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);

/** The server's own field errors after a failed save (a taken link, or its validation). */
export function serverFieldErrors(err: unknown): FieldErrors | null {
  if (!isApiError(err)) return null;
  if (err.code === "SLUG_TAKEN") return { slug: SLUG_TAKEN_MESSAGE };
  const fields = (err.details as { fieldErrors?: Record<string, string[] | undefined> } | null)
    ?.fieldErrors;
  if (err.code !== "VALIDATION_ERROR" || !fields) return null;
  const errors: FieldErrors = {};
  for (const [field, messages] of Object.entries(fields)) {
    if (messages?.[0]) errors[field] = messages[0];
  }
  return hasErrors(errors) ? errors : null;
}

/**
 * Brings the first field in red into view and focuses it — opening the
 * folded "more details" box it may sit in. `delay`: wait for it to render.
 */
export function focusFirstInvalid(root: HTMLElement | null, delay = 0) {
  window.setTimeout(() => {
    const field = root?.querySelector<HTMLElement>(
      '[data-invalid="true"] :is(input, textarea, select)',
    );
    if (!field) return;
    const folded = field.closest("details");
    if (folded) folded.open = true;
    field.scrollIntoView({ block: "center", behavior: "smooth" });
    field.focus({ preventScroll: true });
  }, delay);
}

/**
 * Once a field is shown in red, its message follows what's typed: it updates
 * as the value changes and disappears the moment the value is right. Fields
 * that weren't flagged stay quiet until the next save.
 */
export function useLiveRecheck<T extends object>(
  values: T,
  setErrors: Dispatch<SetStateAction<FieldErrors>>,
  check: (field: keyof T & string) => string | null,
) {
  const previous = useRef(values);
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  });
  useEffect(() => {
    const before = previous.current;
    previous.current = values;
    const changed = (Object.keys(values) as Array<keyof T & string>).filter(
      (field) => values[field] !== before[field],
    );
    if (changed.length === 0) return;
    setErrors((errors) => {
      let next = errors;
      for (const field of changed) {
        if (!errors[field]) continue;
        const message = checkRef.current(field) ?? undefined;
        if (message !== errors[field]) next = { ...next, [field]: message };
      }
      return next;
    });
  }, [values, setErrors]);
}
