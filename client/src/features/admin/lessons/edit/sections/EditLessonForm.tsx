"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { adminLessonsApi, isApiError } from "@/api";
import type { Lesson } from "@/api/types";
import {
  contentRules,
  focusFirstInvalid,
  hasErrors,
  serverFieldErrors,
  useLiveRecheck,
  type FieldErrors,
} from "@/features/admin/shared/formValidation";
import { MoreDetails } from "@/features/admin/shared/form/MoreDetails";
import { Panel } from "@/features/admin/shared/form/Panel";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/features/admin/shared/form/styles";
import { Field } from "../../components/Field";
import {
  LessonEssentials,
  LessonExtras,
  checkLessonField,
  lessonPayload,
  validateLesson,
  type LessonFormValues,
} from "../../components/LessonFields";
import { useEditLesson } from "../EditLessonProvider";

type EditValues = LessonFormValues & { courseId: string; slug: string };

const formOf = (l: Lesson): EditValues => ({
  title: l.title,
  description: l.description,
  longDescription: l.longDescription,
  durationAuto: !!l.durationAuto,
  durationMinutes: l.durationMinutes,
  chapters: l.chapters,
  topics: l.topics,
  courseId: l.courseId,
  slug: l.slug,
});

/** The lesson's details — the same fields as a new lesson, plus where it lives. */
export function EditLessonForm() {
  const { lesson } = useEditLesson();
  // Fresh fields for each lesson (and after a save, from what was stored).
  return lesson ? <LessonDetailsForm key={lesson._id} lesson={lesson} /> : null;
}

function LessonDetailsForm({ lesson }: { lesson: Lesson }) {
  const { courses, setLesson } = useEditLesson();
  const [values, setValues] = useState<EditValues>(() => formOf(lesson));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useLiveRecheck(values, setErrors, (field) =>
    field === "courseId" ? null : field === "slug" ? contentRules.slug(values.slug) : checkLessonField(field, values),
  );

  const change = (patch: Partial<EditValues>) => setValues((v) => ({ ...v, ...patch }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const found = validateLesson(values);
    const slugProblem = contentRules.slug(values.slug);
    if (slugProblem) found.slug = slugProblem;
    if (hasErrors(found)) {
      setErrors(found);
      toast.error("فيه خانات محتاجة تتصلّح — بصّ على اللي باللون الأحمر.");
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    try {
      const slug = values.slug.trim();
      const { lesson: updated } = await adminLessonsApi.update(lesson._id, {
        ...lessonPayload(values, lesson.videoDurationSeconds || null),
        ...(values.courseId !== lesson.courseId ? { courseId: values.courseId } : {}),
        ...(slug !== lesson.slug ? { slug } : {}),
      });
      setLesson(updated);
      setValues(formOf(updated));
      toast.success("اتحفظت بيانات الدرس ✓");
    } catch (err) {
      const fieldErrors = serverFieldErrors(err);
      if (fieldErrors) {
        setErrors(fieldErrors);
        focusFirstInvalid(formRef.current);
      }
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={save} className="space-y-5 sm:space-y-6">
      <Panel title="اسم الدرس ووصفه">
        <LessonEssentials values={values} onChange={change} errors={errors} />
      </Panel>

      <MoreDetails title="تفاصيل إضافية" hint="وصف أطول، محاور الدرس، المدة، وعدد الفصول.">
        <LessonExtras
          values={values}
          onChange={change}
          errors={errors}
          videoSeconds={lesson.videoDurationSeconds || null}
        />
      </MoreDetails>

      <MoreDetails title="إعدادات متقدمة" hint="نقل الدرس لكورس تاني، ورابط صفحة الدرس.">
        <Field label="الكورس" hint="لو نقلته، هيروح آخر الكورس الجديد وياخد مرحلته">
          <select
            value={values.courseId}
            onChange={(e) => change({ courseId: e.target.value })}
            className={INPUT_CLASS}
          >
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="رابط صفحة الدرس" hint="اتعمل لوحده من الاسم — غيّره بس لو محتاج" error={errors.slug}>
          <div dir="ltr" className="flex items-center gap-1">
            <span className="shrink-0 text-xs text-muted-foreground">/lessons/</span>
            <input
              type="text"
              dir="ltr"
              value={values.slug}
              onChange={(e) => change({ slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
        </Field>
        <p className="text-[11px] font-semibold text-amber-600">
          لو غيّرت الرابط، اللينكات القديمة اللي اتبعتت للطلاب مش هتفتح.
        </p>
      </MoreDetails>

      <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}>
        {saving ? "جارٍ الحفظ..." : "احفظ التعديلات"}
      </button>
    </form>
  );
}
