"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { adminCoursesApi, isApiError } from "@/api";
import type { Stage } from "@/api/types";
import { Field } from "@/features/admin/lessons/components/Field";
import { FormSection } from "@/features/admin/lessons/components/FormSection";
import { StepProgress } from "@/features/admin/shared/StepProgress";
import {
  SLUG_TAKEN_MESSAGE,
  contentRules,
  focusFirstInvalid,
  hasErrors,
  serverFieldErrors,
  useLiveRecheck,
  type FieldErrors,
} from "@/features/admin/shared/wizardValidation";
import { isOptimizable } from "@/shared/lib/images";
import { DEFAULT_STAGE, STAGE_LIST } from "@/shared/lib/stage";

interface NewCourseForm {
  title: string;
  slug: string;
  description: string;
  longDescription: string;
  stage: Stage;
  price: number;
}

const initialForm: NewCourseForm = {
  title: "",
  slug: "",
  description: "",
  longDescription: "",
  stage: DEFAULT_STAGE,
  price: 0,
};

const STEPS = [
  { title: "بيانات الكورس" },
  { title: "المرحلة والسعر" },
  { title: "صورة الكورس" },
] as const;

const TOTAL = STEPS.length;

/** The fields typed on each step. */
const STEP_FIELDS: Array<Array<keyof NewCourseForm>> = [
  ["title", "slug", "description", "longDescription"],
  ["stage", "price"],
  [],
];

/** The server's rules for one field (course.validation.ts). */
function checkField(field: keyof NewCourseForm, form: NewCourseForm): string | null {
  switch (field) {
    case "title":
      return contentRules.title(form.title, "الكورس");
    case "slug":
      return contentRules.slug(form.slug);
    case "description":
      return contentRules.description(form.description);
    case "longDescription":
      return contentRules.longDescription(form.longDescription);
    case "price":
      return contentRules.price(form.price);
    default:
      return null;
  }
}

function validateStep(step: number, form: NewCourseForm): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of STEP_FIELDS[step] ?? []) {
    const message = checkField(field, form);
    if (message) errors[field] = message;
  }
  return errors;
}

/** The step a field lives on — where a server error sends the teacher back to. */
const stepOf = (field: string) =>
  STEP_FIELDS.findIndex((fields) => (fields as string[]).includes(field));

export function NewCourseView() {
  const router = useRouter();
  const [form, setForm] = useState<NewCourseForm>(initialForm);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useLiveRecheck(form, setErrors, (field) => checkField(field, form));

  const previewUrl = useMemo(
    () => (thumbnailFile ? URL.createObjectURL(thumbnailFile) : null),
    [thumbnailFile],
  );

  const isLastStep = step === TOTAL - 1;

  /** Moves on only when this step is right — including a link no other course uses. */
  async function next() {
    if (checking) return;
    const found = validateStep(step, form);
    if (step === 0 && !found.slug) {
      setChecking(true);
      try {
        const { available } = await adminCoursesApi.slugAvailable(form.slug.trim());
        if (!available) found.slug = SLUG_TAKEN_MESSAGE;
      } catch {
        // Couldn't ask right now — saving checks it again anyway.
      } finally {
        setChecking(false);
      }
    }
    if (hasErrors(found)) {
      setErrors(found);
      toast.error("فيه خانات محتاجة تتصلّح — بصّ على اللي باللون الأحمر.");
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, TOTAL - 1));
  }

  function prev() {
    if (step === 0) {
      router.back();
      return;
    }
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submitFinal() {
    if (submitting) return;
    setSubmitting(true);
    try {
      setStatusMessage("جارٍ إنشاء الكورس...");
      const { course } = await adminCoursesApi.create({
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        longDescription: form.longDescription.trim(),
        stage: form.stage,
        price: form.price,
      });

      const courseId = String(course._id ?? "");
      if (thumbnailFile && courseId) {
        setStatusMessage("جارٍ رفع صورة الكورس...");
        try {
          await adminCoursesApi.uploadThumbnail(courseId, thumbnailFile);
        } catch (err) {
          toast.warning(
            isApiError(err)
              ? `تم إنشاء الكورس لكن فشل رفع الصورة: ${err.message}`
              : "تم إنشاء الكورس. ارفع الصورة لاحقاً من صفحة التعديل.",
          );
        }
      }

      toast.success("تم إنشاء الكورس — دلوقتي ضيف دروسه");
      router.push(`/admin/courses/${courseId}`);
    } catch (err) {
      // Something only the server knows (e.g. the link got taken meanwhile):
      // back to that field's step, with the message under it.
      const fieldErrors = serverFieldErrors(err);
      if (fieldErrors) {
        const back = Math.min(
          ...Object.keys(fieldErrors).map((f) => (stepOf(f) >= 0 ? stepOf(f) : step)),
        );
        setErrors(fieldErrors);
        setStep(back);
        toast.error("فيه خانة محتاجة تتصلّح — رجّعناك للخطوة بتاعتها.");
        focusFirstInvalid(formRef.current, 320);
      } else {
        toast.error(isApiError(err) ? err.message : "حصل خطأ غير متوقع");
      }
    } finally {
      setSubmitting(false);
      setStatusMessage("");
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (isLastStep) void submitFinal();
    else void next();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
          كورس جديد
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          قسّمنا الإنشاء لخطوات بسيطة — كمّل خطوة خطوة لحد ما تحفظ الكورس.
        </p>
      </div>

      <StepProgress step={step} steps={STEPS} />

      {submitting && statusMessage && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm font-bold text-primary">
          {statusMessage}
        </div>
      )}

      <form
        ref={formRef}
        noValidate
        onSubmit={onSubmit}
        className="space-y-6 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6"
      >
        <div className="min-h-[240px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {step === 0 && (
                <FormSection title="البيانات الأساسية">
                  <Field label="عنوان الكورس" error={errors.title}>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, title: e.target.value }))
                      }
                      className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="مثال: كورس الخلية والوراثة — الترم الأول"
                    />
                  </Field>

                  <Field
                    label="رابط الكورس"
                    hint="حروف إنجليزية صغيرة وشرطات بدل المسافات"
                    error={errors.slug}
                  >
                    <input
                      type="text"
                      dir="ltr"
                      value={form.slug}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          slug: e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "-"),
                        }))
                      }
                      className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="nahw-term-1"
                    />
                  </Field>

                  <Field label="وصف قصير" hint="يظهر في كارت الكورس" error={errors.description}>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, description: e.target.value }))
                      }
                      className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="جملة أو جملتين تشرح الكورس باختصار"
                    />
                  </Field>

                  <Field label="وصف تفصيلي" hint="يظهر في صفحة الكورس" error={errors.longDescription}>
                    <textarea
                      rows={5}
                      value={form.longDescription}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          longDescription: e.target.value,
                        }))
                      }
                      className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="اشرح للطالب محتوى الكورس وأهدافه"
                    />
                  </Field>
                </FormSection>
              )}

              {step === 1 && (
                <FormSection title="المرحلة والسعر">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="المرحلة">
                      <select
                        value={form.stage}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            stage: e.target.value as Stage,
                          }))
                        }
                        className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {STAGE_LIST.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.longLabel}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="السعر (جنيه)" hint="حط 0 لو الكورس مجاني" error={errors.price}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.price}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, "");
                          setForm((p) => ({
                            ...p,
                            price: digits === "" ? 0 : Number(digits),
                          }));
                        }}
                        className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </Field>
                  </div>
                </FormSection>
              )}

              {step === 2 && (
                <FormSection title="صورة الكورس المصغّرة" optional>
                  <p className="text-xs text-muted-foreground">
                    صورة أفقية (١٢٨٠×٧٢٠) تظهر في كارت الكورس. لو مرفعتش صورة،
                    هيتحط تدرّج لوني افتراضي.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
                    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background">
                      {previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt="معاينة"
                          fill
                          sizes="(min-width: 640px) 180px, 100vw"
                          unoptimized={!isOptimizable(previewUrl)}
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          لا توجد صورة
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) =>
                          setThumbnailFile(e.target.files?.[0] || null)
                        }
                        className="block w-full text-xs file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-4 file:py-2 file:text-xs file:font-bold hover:file:bg-muted"
                      />
                      {thumbnailFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setThumbnailFile(null);
                            if (inputRef.current) inputRef.current.value = "";
                          }}
                          className="rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600 hover:bg-red-500/20"
                        >
                          حذف الصورة
                        </button>
                      )}
                    </div>
                  </div>
                </FormSection>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3 border-t border-border/60 pt-4">
          <button
            type="button"
            disabled={submitting}
            onClick={prev}
            className="min-h-[44px] rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-50"
          >
            {step === 0 ? "رجوع" : "السابق"}
          </button>
          <button
            type="submit"
            disabled={submitting || checking}
            className="min-h-[44px] flex-1 rounded-xl bg-gradient-brand px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-brand transition-transform hover:scale-[1.02] disabled:opacity-50 sm:flex-none"
          >
            {isLastStep
              ? submitting
                ? statusMessage || "جارٍ الحفظ..."
                : "حفظ الكورس"
              : checking
                ? "لحظة..."
                : "التالي"}
          </button>
        </div>
      </form>
    </div>
  );
}
