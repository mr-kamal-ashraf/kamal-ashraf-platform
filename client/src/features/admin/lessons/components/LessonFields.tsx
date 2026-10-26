"use client";

import { INPUT_CLASS, TEXTAREA_CLASS } from "@/features/admin/shared/form/styles";
import { contentRules, type FieldErrors } from "@/features/admin/shared/formValidation";
import { cn } from "@/shared/lib/cn";
import { Field } from "./Field";
import { formatVideoLength } from "./LessonVideoPicker";
import { TopicsListField } from "./TopicsListField";

/** What the teacher types about a lesson — the same on the new and edit pages. */
export interface LessonFormValues {
  title: string;
  description: string;
  /** Empty: the lesson page shows the short description. */
  longDescription: string;
  /** The duration follows the video's real length. */
  durationAuto: boolean;
  durationMinutes: number;
  chapters: number;
  topics: string[];
}

export const EMPTY_LESSON: LessonFormValues = {
  title: "",
  description: "",
  longDescription: "",
  durationAuto: true,
  durationMinutes: 30,
  chapters: 1,
  topics: [],
};

/** The server's rules for each field (lesson.validation.ts), in the teacher's words. */
export function checkLessonField(field: keyof LessonFormValues, v: LessonFormValues): string | null {
  switch (field) {
    case "title":
      return contentRules.title(v.title, "الدرس");
    case "description":
      return contentRules.description(v.description);
    case "longDescription":
      return contentRules.optionalLongDescription(v.longDescription);
    case "durationMinutes":
      return v.durationAuto ? null : contentRules.durationMinutes(v.durationMinutes);
    case "chapters":
      return contentRules.chapters(v.chapters);
    case "topics":
      return contentRules.topics(v.topics);
    default:
      return null;
  }
}

export function validateLesson(v: LessonFormValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of Object.keys(v) as Array<keyof LessonFormValues>) {
    const message = checkLessonField(field, v);
    if (message) errors[field] = message;
  }
  return errors;
}

/** What the server takes from the form (durations follow the video unless typed). */
export function lessonPayload(v: LessonFormValues, videoSeconds: number | null) {
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    longDescription: v.longDescription.trim(),
    durationAuto: v.durationAuto,
    durationMinutes: v.durationAuto
      ? videoSeconds
        ? Math.max(1, Math.round(videoSeconds / 60))
        : undefined
      : v.durationMinutes,
    chapters: v.chapters,
    topics: v.topics.map((t) => t.trim()).filter(Boolean),
  };
}

interface FieldsProps {
  values: LessonFormValues;
  onChange: (patch: Partial<LessonFormValues>) => void;
  errors: FieldErrors;
}

/** The two things every lesson needs: its name and a line about it. */
export function LessonEssentials({ values, onChange, errors }: FieldsProps) {
  return (
    <>
      <Field label="اسم الدرس" error={errors.title}>
        <input
          type="text"
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className={INPUT_CLASS}
          placeholder="مثال: الدرس الأول — تركيب الخلية"
        />
      </Field>
      <Field
        label="وصف قصير"
        hint="سطر أو اتنين بيظهروا للطالب تحت اسم الدرس"
        error={errors.description}
      >
        <textarea
          rows={2}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={TEXTAREA_CLASS}
          placeholder="الدرس ده بيشرح..."
        />
      </Field>
    </>
  );
}

/**
 * The optional details. `videoSeconds`: the video's length when known — the
 * duration follows it unless the teacher types their own.
 */
export function LessonExtras({
  values,
  onChange,
  errors,
  videoSeconds,
}: FieldsProps & { videoSeconds: number | null }) {
  return (
    <>
      <Field
        label="وصف تفصيلي"
        hint="لو سبته فاضي، صفحة الدرس هتعرض الوصف القصير"
        error={errors.longDescription}
      >
        <textarea
          rows={4}
          value={values.longDescription}
          onChange={(e) => onChange({ longDescription: e.target.value })}
          className={TEXTAREA_CLASS}
          placeholder="اشرح للطالب هيتعلم إيه في الدرس ده"
        />
      </Field>

      <Field label="محاور الدرس" hint="دوس Enter عشان تضيف محور جديد" error={errors.topics}>
        <TopicsListField value={values.topics} onChange={(topics) => onChange({ topics })} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset
          data-invalid={errors.durationMinutes ? "true" : undefined}
          className="space-y-2"
        >
          <legend className="mb-1.5 text-xs font-bold text-foreground">مدة الدرس</legend>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm">
            <input
              type="checkbox"
              checked={values.durationAuto}
              onChange={(e) => onChange({ durationAuto: e.target.checked })}
              className="size-4 accent-primary"
            />
            احسبها من الفيديو لوحدها
          </label>
          {values.durationAuto ? (
            <p className="text-xs text-muted-foreground">
              {videoSeconds
                ? `مدة الفيديو: ${formatVideoLength(videoSeconds)}`
                : "هتتحسب أول ما الفيديو يترفع."}
            </p>
          ) : (
            <div className="relative">
              <input
                type="number"
                min={1}
                aria-label="مدة الدرس بالدقايق"
                value={values.durationMinutes || ""}
                onChange={(e) => onChange({ durationMinutes: Number(e.target.value) })}
                className={cn(INPUT_CLASS, errors.durationMinutes && "border-destructive", "pe-16")}
              />
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-bold text-muted-foreground">
                دقيقة
              </span>
            </div>
          )}
          {errors.durationMinutes && (
            <p role="alert" className="text-xs font-semibold text-destructive">
              {errors.durationMinutes}
            </p>
          )}
        </fieldset>

        <Field label="عدد الفصول" hint="بيظهر في صفحة الدرس" error={errors.chapters}>
          <input
            type="number"
            min={1}
            value={values.chapters || ""}
            onChange={(e) => onChange({ chapters: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
    </>
  );
}
