"use client";

import type { Stage } from "@/api/types";
import { Field } from "@/features/admin/lessons/components/Field";
import { contentRules, type FieldErrors } from "@/features/admin/shared/formValidation";
import { PriceField } from "@/features/admin/shared/form/PriceField";
import { StagePicker } from "@/features/admin/shared/form/StagePicker";
import { INPUT_CLASS, TEXTAREA_CLASS } from "@/features/admin/shared/form/styles";
import { DEFAULT_STAGE } from "@/shared/lib/stage";

/** What the teacher types about a course — the same on the new and edit pages. */
export interface CourseFormValues {
  title: string;
  description: string;
  /** Empty: the course page shows the short description. */
  longDescription: string;
  stage: Stage;
  price: number;
}

export const EMPTY_COURSE: CourseFormValues = {
  title: "",
  description: "",
  longDescription: "",
  stage: DEFAULT_STAGE,
  price: 0,
};

/** The server's rules for each field (course.validation.ts), in the teacher's words. */
export function validateCourse(v: CourseFormValues): FieldErrors {
  const found: FieldErrors = {
    title: contentRules.title(v.title, "الكورس") ?? undefined,
    description: contentRules.description(v.description) ?? undefined,
    longDescription: contentRules.optionalLongDescription(v.longDescription) ?? undefined,
    price: contentRules.price(v.price) ?? undefined,
  };
  return Object.fromEntries(Object.entries(found).filter(([, m]) => m));
}

export function checkCourseField(field: keyof CourseFormValues, v: CourseFormValues) {
  return validateCourse(v)[field] ?? null;
}

export function coursePayload(v: CourseFormValues) {
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    longDescription: v.longDescription.trim(),
    stage: v.stage,
    price: v.price,
  };
}

interface FieldsProps {
  values: CourseFormValues;
  onChange: (patch: Partial<CourseFormValues>) => void;
  errors: FieldErrors;
  /** On an existing course: changing the stage moves all its lessons too. */
  editing?: boolean;
}

/** Name, a line about it, who it's for and its price — all a course needs. */
export function CourseEssentials({ values, onChange, errors, editing }: FieldsProps) {
  return (
    <>
      <Field label="اسم الكورس" error={errors.title}>
        <input
          type="text"
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className={INPUT_CLASS}
          placeholder="مثال: الأحياء — الترم الأول"
        />
      </Field>
      <Field
        label="وصف قصير"
        hint="سطر أو اتنين بيظهروا على كارت الكورس"
        error={errors.description}
      >
        <textarea
          rows={2}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={TEXTAREA_CLASS}
          placeholder="شرح كامل لمنهج الترم مع مراجعات وحل أسئلة"
        />
      </Field>
      <div>
        <span className="mb-1.5 block text-xs font-bold text-foreground">
          المرحلة
          {editing && (
            <span className="ms-2 font-normal text-muted-foreground">
              — تغييرها بيغيّر مرحلة كل الدروس
            </span>
          )}
        </span>
        <StagePicker value={values.stage} onChange={(stage) => onChange({ stage })} />
      </div>
      <div data-invalid={errors.price ? "true" : undefined} className="sm:max-w-sm">
        <span className="mb-1.5 block text-xs font-bold text-foreground">السعر</span>
        <PriceField value={values.price} onChange={(price) => onChange({ price })} />
        {errors.price && (
          <p role="alert" className="mt-1.5 text-xs font-semibold text-destructive">
            {errors.price}
          </p>
        )}
      </div>
    </>
  );
}

/** The longer text on the course page — optional. */
export function CourseLongDescription({ values, onChange, errors }: FieldsProps) {
  return (
    <Field
      label="وصف تفصيلي"
      hint="لو سبته فاضي، صفحة الكورس هتعرض الوصف القصير"
      error={errors.longDescription}
    >
      <textarea
        rows={5}
        value={values.longDescription}
        onChange={(e) => onChange({ longDescription: e.target.value })}
        className={TEXTAREA_CLASS}
        placeholder="اشرح للطالب الكورس فيه إيه وهيستفيد إيه"
      />
    </Field>
  );
}
