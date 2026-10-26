"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminCoursesApi, isApiError } from "@/api";
import {
  focusFirstInvalid,
  hasErrors,
  serverFieldErrors,
  useLiveRecheck,
  type FieldErrors,
} from "@/features/admin/shared/formValidation";
import { ImagePicker, useObjectUrl } from "@/features/admin/shared/form/ImagePicker";
import { MoreDetails } from "@/features/admin/shared/form/MoreDetails";
import { Panel } from "@/features/admin/shared/form/Panel";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/features/admin/shared/form/styles";
import { BackLink } from "@/features/admin/shared/BackLink";
import {
  CourseEssentials,
  CourseLongDescription,
  EMPTY_COURSE,
  checkCourseField,
  coursePayload,
  validateCourse,
  type CourseFormValues,
} from "../components/CourseFields";
import { CoursePreview } from "../components/CoursePreview";

/**
 * A new course on one page: name, a line about it, the stage and the price
 * (its link is made from the name). Saving opens the course, ready for its
 * lessons.
 */
export function NewCourseView() {
  const router = useRouter();
  const [values, setValues] = useState<CourseFormValues>(EMPTY_COURSE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const imageUrl = useObjectUrl(imageFile);

  useLiveRecheck(values, setErrors, (field) => checkCourseField(field, values));

  const change = (patch: Partial<CourseFormValues>) => setValues((v) => ({ ...v, ...patch }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const found = validateCourse(values);
    if (hasErrors(found)) {
      setErrors(found);
      toast.error("فيه خانات محتاجة تتصلّح — بصّ على اللي باللون الأحمر.");
      focusFirstInvalid(formRef.current);
      return;
    }

    setSaving(true);
    try {
      const { course } = await adminCoursesApi.create(coursePayload(values));
      if (imageFile) {
        try {
          await adminCoursesApi.uploadThumbnail(course._id, imageFile);
        } catch (err) {
          toast.warning(
            `الكورس اتعمل، بس الصورة ماترفعتش${isApiError(err) ? `: ${err.message}` : ""} — ارفعها من صفحة الكورس.`,
          );
        }
      }
      toast.success("الكورس اتعمل ✓ — دلوقتي ضيف دروسه");
      router.push(`/admin/courses/${course._id}`);
    } catch (err) {
      const fieldErrors = serverFieldErrors(err);
      if (fieldErrors) {
        setErrors(fieldErrors);
        toast.error("فيه خانة محتاجة تتصلّح — بصّ على اللي باللون الأحمر.");
        focusFirstInvalid(formRef.current);
      } else {
        toast.error(isApiError(err) ? err.message : "حصل خطأ غير متوقع");
      }
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
      <div>
        <BackLink href="/admin/courses">الكورسات</BackLink>
        <h1 className="mt-1 text-xl font-extrabold text-foreground sm:text-2xl">كورس جديد</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          اكتب بيانات الكورس واحفظ — وبعدها هتضيف الدروس جواه.
        </p>
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={save}
        className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start"
      >
        <div className="space-y-5 sm:space-y-6">
          <Panel title="بيانات الكورس">
            <CourseEssentials values={values} onChange={change} errors={errors} />
          </Panel>

          <Panel title="صورة الكورس" optional hint="بتظهر على كارت الكورس وفي صفحته.">
            <ImagePicker
              imageUrl={imageUrl}
              onFile={setImageFile}
              onClear={() => setImageFile(null)}
            />
          </Panel>

          <MoreDetails title="وصف تفصيلي" hint="كلام أطول بيظهر في صفحة الكورس.">
            <CourseLongDescription values={values} onChange={change} errors={errors} />
          </MoreDetails>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <Link href="/admin/courses" className={SECONDARY_BUTTON_CLASS}>
              إلغاء
            </Link>
            <button type="submit" disabled={saving} className={PRIMARY_BUTTON_CLASS}>
              {saving ? "جارٍ الحفظ..." : "احفظ الكورس وكمّل للدروس"}
            </button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6">
          <CoursePreview values={values} imageUrl={imageUrl} />
        </aside>
      </form>
    </div>
  );
}
