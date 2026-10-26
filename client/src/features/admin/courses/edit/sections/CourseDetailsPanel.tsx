"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminCoursesApi, isApiError } from "@/api";
import type { Course } from "@/api/types";
import { resolveAssetUrl } from "@/config/env";
import { Field } from "@/features/admin/lessons/components/Field";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import {
  contentRules,
  focusFirstInvalid,
  hasErrors,
  serverFieldErrors,
  type FieldErrors,
} from "@/features/admin/shared/formValidation";
import { ImagePicker } from "@/features/admin/shared/form/ImagePicker";
import { MoreDetails } from "@/features/admin/shared/form/MoreDetails";
import { Panel } from "@/features/admin/shared/form/Panel";
import {
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/features/admin/shared/form/styles";
import { CoverArt } from "@/shared/components/bio";
import { isOptimizable } from "@/shared/lib/images";
import { getLessonGradient } from "@/shared/lib/stage";
import { StageBadge } from "@/shared/ui/StageBadge";
import {
  CourseEssentials,
  CourseLongDescription,
  coursePayload,
  validateCourse,
  type CourseFormValues,
} from "../../components/CourseFields";

const formOf = (c: Course): CourseFormValues & { slug: string } => ({
  title: c.title,
  description: c.description,
  longDescription: c.longDescription,
  stage: c.stage,
  price: c.price,
  slug: c.slug,
});

/**
 * The course's details: shown as a summary, edited on "تعديل" (its picture is
 * saved the moment it's picked). Deleting the course lives here too, out of
 * the way.
 */
export function CourseDetailsPanel({
  course,
  onCourse,
}: {
  course: Course;
  onCourse: (course: Course) => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(() => formOf(course));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const imageUrl = resolveAssetUrl(course.thumbnail);

  const change = (patch: Partial<CourseFormValues & { slug: string }>) =>
    setValues((v) => ({ ...v, ...patch }));

  function startEditing() {
    setValues(formOf(course));
    setErrors({});
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const found = validateCourse(values);
    const slugProblem = values.slug.trim() ? contentRules.slug(values.slug) : null;
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
      const { course: updated } = await adminCoursesApi.update(course._id, {
        ...coursePayload(values),
        ...(slug && slug !== course.slug ? { slug } : {}),
      });
      onCourse(updated);
      setEditing(false);
      toast.success("اتحفظت بيانات الكورس ✓");
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

  async function uploadImage(file: File) {
    setImageBusy(true);
    try {
      const { course: updated } = await adminCoursesApi.uploadThumbnail(course._id, file);
      onCourse(updated);
      toast.success("اتحفظت صورة الكورس ✓");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "مقدرناش نرفع الصورة");
    } finally {
      setImageBusy(false);
    }
  }

  async function clearImage() {
    setImageBusy(true);
    try {
      const { course: updated } = await adminCoursesApi.clearThumbnail(course._id);
      onCourse(updated);
      toast.success("اتشالت الصورة");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    } finally {
      setImageBusy(false);
    }
  }

  async function deleteCourse() {
    if (
      !(await confirm({
        title: "حذف الكورس",
        message: `هيتحذف كورس «${course.title}» وكل دروسه، وهيتشال من كل الطلاب المشتركين فيه. مفيش تراجع بعد كده.`,
        confirmLabel: "حذف الكورس",
        tone: "danger",
      }))
    )
      return;
    try {
      await adminCoursesApi.delete(course._id);
      toast.success("الكورس اتحذف");
      router.push("/admin/courses");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }

  if (editing) {
    return (
      <form ref={formRef} noValidate onSubmit={save} className="space-y-5 sm:space-y-6">
        <Panel title="تعديل بيانات الكورس">
          <CourseEssentials values={values} onChange={change} errors={errors} editing />
        </Panel>
        <Panel title="صورة الكورس" optional hint="بتتحفظ أول ما تختارها.">
          <ImagePicker
            imageUrl={imageUrl}
            onFile={uploadImage}
            onClear={course.thumbnail ? clearImage : undefined}
            busy={imageBusy}
          />
        </Panel>
        <MoreDetails title="وصف تفصيلي" hint="كلام أطول بيظهر في صفحة الكورس.">
          <CourseLongDescription values={values} onChange={change} errors={errors} />
        </MoreDetails>
        <MoreDetails title="إعدادات متقدمة" hint="رابط صفحة الكورس.">
          <Field
            label="رابط صفحة الكورس"
            hint="اتعمل لوحده من الاسم — غيّره بس لو محتاج"
            error={errors.slug}
          >
            <div dir="ltr" className="flex items-center gap-1">
              <span className="shrink-0 text-xs text-muted-foreground">/courses/</span>
              <input
                type="text"
                dir="ltr"
                value={values.slug}
                onChange={(e) =>
                  change({ slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })
                }
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </Field>
          <p className="text-[11px] font-semibold text-amber-600">
            لو غيّرته، اللينكات القديمة اللي اتبعتت للطلاب مش هتفتح.
          </p>
        </MoreDetails>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button type="button" onClick={() => setEditing(false)} className={SECONDARY_BUTTON_CLASS}>
            إلغاء
          </button>
          <button type="submit" disabled={saving} className={PRIMARY_BUTTON_CLASS}>
            {saving ? "جارٍ الحفظ..." : "احفظ التعديلات"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <Panel
      title="بيانات الكورس"
      aside={
        <button
          type="button"
          onClick={startEditing}
          className="inline-flex min-h-[40px] items-center rounded-xl border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-muted"
        >
          تعديل البيانات
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
        <div
          className="relative aspect-video overflow-hidden rounded-xl border border-border"
          style={{ background: getLessonGradient(course.stage, course.thumbnailGradient) }}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="192px"
              unoptimized={!isOptimizable(imageUrl)}
              className="object-cover"
            />
          ) : (
            <CoverArt seed={course.slug} glyphClassName="size-12" />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-extrabold text-foreground">{course.title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{course.description}</p>
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={course.stage} />
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
              {course.price > 0 ? `${course.price} جنيه` : "مجاني"}
            </span>
          </div>
        </div>
      </div>
      <div className="flex justify-end border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={deleteCourse}
          className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/10"
        >
          حذف الكورس
        </button>
      </div>
    </Panel>
  );
}
