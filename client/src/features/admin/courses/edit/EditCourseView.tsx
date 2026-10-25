"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  adminCoursesApi,
  adminLessonsApi,
  isApiError,
} from "@/api";
import type { Course, Lesson, Stage } from "@/api/types";
import { resolveAssetUrl } from "@/config/env";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { Field } from "@/features/admin/lessons/components/Field";
import { FormSection } from "@/features/admin/lessons/components/FormSection";
import { PublishStatus } from "@/features/admin/lessons/components/PublishStatus";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import { isOptimizable } from "@/shared/lib/images";
import { STAGE_LIST } from "@/shared/lib/stage";
import { CourseCodesSection } from "./CourseCodesSection";

interface EditForm {
  title: string;
  slug: string;
  description: string;
  longDescription: string;
  stage: Stage;
  price: number;
}

export function EditCourseView({ courseId }: { courseId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [form, setForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ course: c }, lessonsRes] = await Promise.all([
        adminCoursesApi.get(courseId),
        adminLessonsApi.list({ courseId, limit: 100 }),
      ]);
      setCourse(c);
      setForm({
        title: c.title,
        slug: c.slug,
        description: c.description,
        longDescription: c.longDescription,
        stage: c.stage,
        price: c.price,
      });
      setLessons(lessonsRes.items);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const thumbUrl = useMemo(
    () => resolveAssetUrl(course?.thumbnail),
    [course?.thumbnail],
  );

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    try {
      const { course: updated } = await adminCoursesApi.update(courseId, {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        longDescription: form.longDescription.trim(),
        stage: form.stage,
        price: form.price,
      });
      setCourse(updated);
      toast.success("تم حفظ الكورس");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function uploadThumb(file: File) {
    try {
      const { course: updated } = await adminCoursesApi.uploadThumbnail(
        courseId,
        file,
      );
      setCourse(updated);
      toast.success("تم رفع الصورة");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "فشل رفع الصورة");
    }
  }

  async function clearThumb() {
    try {
      const { course: updated } = await adminCoursesApi.clearThumbnail(courseId);
      setCourse(updated);
      toast.success("تم حذف الصورة");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }

  async function togglePublish() {
    if (!course) return;
    try {
      const { course: updated } = await adminCoursesApi.togglePublish(
        courseId,
        !course.isPublished,
      );
      setCourse(updated);
      toast.success(course.isPublished ? "تم الإخفاء" : "تم النشر");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }

  async function deleteCourse() {
    if (!course) return;
    if (
      !(await confirm({
        title: "حذف الكورس",
        message: `هيتحذف كورس "${course.title}" وكل دروسه، وهيتشال من كل الطلاب المشتركين فيه. مفيش تراجع بعد كده.`,
        confirmLabel: "حذف",
        tone: "danger",
      }))
    )
      return;
    try {
      await adminCoursesApi.delete(courseId);
      toast.success("تم حذف الكورس");
      router.push("/admin/courses");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }

  async function toggleLessonPublish(lesson: Lesson) {
    try {
      await adminLessonsApi.togglePublish(lesson._id, !lesson.isPublished);
      await load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }

  async function deleteLesson(lesson: Lesson) {
    if (
      !(await confirm({
        title: "حذف الدرس",
        message: `متأكد من حذف درس "${lesson.title}"؟`,
        confirmLabel: "حذف",
        tone: "danger",
      }))
    )
      return;
    try {
      await adminLessonsApi.delete(lesson._id);
      toast.success("تم حذف الدرس");
      await load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }

  if (loading || !form || !course) return <LoadingScreen variant="page" />;

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold text-foreground sm:text-2xl">
            {course.title}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <PublishStatus published={course.isPublished} />
            <span className="text-xs text-muted-foreground">
              {course.price > 0 ? `${course.price} ج.م` : "مجاني"}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={togglePublish}
            className="min-h-[40px] rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted"
          >
            {course.isPublished ? "إخفاء الكورس" : "نشر الكورس"}
          </button>
          <button
            type="button"
            onClick={deleteCourse}
            className="min-h-[40px] rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500/20"
          >
            حذف
          </button>
        </div>
      </div>

      {/* Metadata form */}
      <form
        onSubmit={saveMeta}
        className="space-y-6 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6"
      >
        <FormSection title="بيانات الكورس">
          <Field label="عنوان الكورس">
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((p) => p && { ...p, title: e.target.value })}
              className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
          <Field label="رابط الكورس">
            <input
              type="text"
              required
              dir="ltr"
              value={form.slug}
              onChange={(e) =>
                setForm(
                  (p) =>
                    p && {
                      ...p,
                      slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    },
                )
              }
              className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
          <Field label="وصف قصير">
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((p) => p && { ...p, description: e.target.value })
              }
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
          <Field label="وصف تفصيلي">
            <textarea
              required
              rows={5}
              value={form.longDescription}
              onChange={(e) =>
                setForm((p) => p && { ...p, longDescription: e.target.value })
              }
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="المرحلة" hint="تغييرها بيغيّر مرحلة كل الدروس">
              <select
                value={form.stage}
                onChange={(e) =>
                  setForm((p) => p && { ...p, stage: e.target.value as Stage })
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
            <Field label="السعر (جنيه)">
              <input
                type="text"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "");
                  setForm(
                    (p) => p && { ...p, price: digits === "" ? 0 : Number(digits) },
                  );
                }}
                className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="صورة الكورس">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background">
              {thumbUrl ? (
                <Image
                  src={thumbUrl}
                  alt="صورة الكورس"
                  fill
                  sizes="(min-width: 640px) 180px, 100vw"
                  unoptimized={!isOptimizable(thumbUrl)}
                  className="object-cover"
                />
              ) : (
                <span className="text-xs text-muted-foreground">لا توجد صورة</span>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadThumb(f);
                }}
                className="block w-full text-xs file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-4 file:py-2 file:text-xs file:font-bold hover:file:bg-muted"
              />
              {course.thumbnail && (
                <button
                  type="button"
                  onClick={clearThumb}
                  className="rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600 hover:bg-red-500/20"
                >
                  حذف الصورة الحالية
                </button>
              )}
            </div>
          </div>
        </FormSection>

        <div className="flex border-t border-border/60 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] w-full rounded-xl bg-gradient-brand px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-50 sm:w-auto"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
          </button>
        </div>
      </form>

      {/* Lessons of this course */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-foreground">
              دروس الكورس
            </h2>
            <p className="text-xs text-muted-foreground">
              لازم يكون فيه درس منشور واحد على الأقل عشان تقدر تنشر الكورس.
            </p>
          </div>
          <Link
            href={`/admin/lessons/new?courseId=${courseId}`}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-gradient-brand px-4 py-2 text-xs font-bold text-primary-foreground shadow-brand"
          >
            + درس جديد
          </Link>
        </div>

        {lessons.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-background py-8 text-center text-xs text-muted-foreground">
            لسه مفيش دروس في الكورس ده.
          </p>
        ) : (
          <ul className="space-y-2">
            {lessons.map((lesson) => (
              <li
                key={lesson._id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">
                    {lesson.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {lesson.durationMinutes} دقيقة ·{" "}
                    {lesson.bunnyVideoId ? "فيه فيديو" : "لسه مفيش فيديو"}
                  </p>
                </div>
                <PublishStatus published={lesson.isPublished} />
                <Link
                  href={`/admin/lessons/${lesson._id}`}
                  className="min-h-[34px] rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                >
                  تعديل
                </Link>
                <button
                  type="button"
                  onClick={() => toggleLessonPublish(lesson)}
                  className="min-h-[34px] rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                >
                  {lesson.isPublished ? "إخفاء" : "نشر"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteLesson(lesson)}
                  className="min-h-[34px] rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/20"
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CourseCodesSection
        courseId={courseId}
        coursePrice={course.price}
        published={course.isPublished}
      />
    </div>
  );
}
