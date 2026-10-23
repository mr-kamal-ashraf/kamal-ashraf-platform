"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { adminCoursesApi, isApiError } from "@/api";
import type { BulkCourseAction } from "@/api/admin/courses";
import type { CourseAdminItem, PaginatedResult, Stage } from "@/api/types";
import { StageBadge } from "@/shared/ui/StageBadge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PublishStatus } from "@/features/admin/lessons/components/PublishStatus";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import { useDebounced } from "@/shared/hooks/useDebounced";
import { STAGE_LIST } from "@/shared/lib/stage";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

export function CoursesListView() {
  const confirm = useConfirm();
  const [stage, setStage] = useState<"" | Stage>("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<PaginatedResult<CourseAdminItem> | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const debouncedSearch = useDebounced(search, 300);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await adminCoursesApi.list({
        stage: stage || undefined,
        search: debouncedSearch || undefined,
        limit: 50,
      });
      setData(result);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    } finally {
      setIsLoading(false);
    }
  }, [stage, debouncedSearch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const togglePublish = useCallback(
    async (course: CourseAdminItem) => {
      try {
        await adminCoursesApi.togglePublish(course._id, !course.isPublished);
        toast.success(course.isPublished ? "تم الإخفاء" : "تم النشر");
        await refresh();
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      }
    },
    [refresh],
  );

  const deleteCourse = useCallback(
    async (course: CourseAdminItem) => {
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
        await adminCoursesApi.delete(course._id);
        toast.success("تم الحذف");
        await refresh();
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      }
    },
    [refresh, confirm],
  );

  const courses = useMemo(() => data?.items ?? [], [data]);
  const allVisibleSelected =
    courses.length > 0 &&
    courses.every((course) => selectedCourseIds.has(course._id));

  const toggleCourseSelection = useCallback((courseId: string) => {
    setSelectedCourseIds((current) => {
      const next = new Set(current);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }, []);

  const toggleVisibleCourses = useCallback(() => {
    if (courses.length === 0) return;
    setSelectedCourseIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) courses.forEach((course) => next.delete(course._id));
      else courses.forEach((course) => next.add(course._id));
      return next;
    });
  }, [allVisibleSelected, courses]);

  const runBulkAction = useCallback(
    async (action: BulkCourseAction) => {
      if (isBulkSubmitting || selectedCourseIds.size === 0) return;
      const count = selectedCourseIds.size;
      const labels = {
        publish: {
          title: "نشر كورسات متعددة",
          message: `هتنشر ${count} كورس. الكورس لازم يكون فيه درس منشور على الأقل. متأكد؟`,
          confirmLabel: "نشر الكورسات",
          tone: "default" as const,
          done: "تم نشر",
        },
        unpublish: {
          title: "إخفاء كورسات متعددة",
          message: `هتخفي ${count} كورس من الطلاب. متأكد؟`,
          confirmLabel: "إخفاء الكورسات",
          tone: "danger" as const,
          done: "تم إخفاء",
        },
        delete: {
          title: "حذف كورسات نهائيًا",
          message: `هتحذف ${count} كورس بكل دروسه واشتراكات الطلاب فيه نهائيًا. لا يمكن التراجع عن الإجراء. متأكد؟`,
          confirmLabel: "حذف نهائي",
          tone: "danger" as const,
          done: "تم حذف",
        },
      }[action];
      if (!(await confirm(labels))) return;

      setIsBulkSubmitting(true);
      try {
        const result = await adminCoursesApi.bulkAction(action, [
          ...selectedCourseIds,
        ]);
        setSelectedCourseIds(new Set());
        toast.success(`${labels.done} ${result.processed} كورس`);
        if (result.missingIds.length || result.failedIds.length) {
          toast.error(
            `${result.missingIds.length + result.failedIds.length} كورس لم يكتمل الإجراء عليه`,
          );
        }
        await refresh();
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ أثناء تنفيذ الإجراء");
      } finally {
        setIsBulkSubmitting(false);
      }
    },
    [confirm, isBulkSubmitting, refresh, selectedCourseIds],
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
            الكورسات
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            أنشئ كورسات، حدّد سعرها ومرحلتها، وحط جواها الدروس.
          </p>
        </div>
        <Link
          href="/admin/courses/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-brand"
        >
          + كورس جديد
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم الكورس..."
          className="min-h-[44px] rounded-xl border border-border bg-card px-4 py-2.5 text-sm sm:min-w-64"
        />
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as "" | Stage)}
          className="min-h-[44px] rounded-xl border border-border bg-card px-4 py-2.5 text-sm sm:w-auto"
        >
          <option value="">كل المراحل</option>
          {STAGE_LIST.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {selectedCourseIds.size > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-soft sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-4">
          <p className="text-sm font-extrabold text-foreground">
            تم تحديد {selectedCourseIds.size} كورس
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void runBulkAction("publish")} disabled={isBulkSubmitting} className="min-h-[40px] rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">نشر</button>
            <button type="button" onClick={() => void runBulkAction("unpublish")} disabled={isBulkSubmitting} className="min-h-[40px] rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">إخفاء</button>
            <button type="button" onClick={() => void runBulkAction("delete")} disabled={isBulkSubmitting} className="min-h-[40px] rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-white disabled:opacity-50">حذف نهائي</button>
            <button type="button" onClick={() => setSelectedCourseIds(new Set())} disabled={isBulkSubmitting} className="min-h-[40px] rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground disabled:opacity-50">إلغاء التحديد</button>
          </div>
        </section>
      )}

      {/* List */}
      {/* First load: the full loading screen; a search reload dims the cards. */}
      {isLoading && !data ? (
        <LoadingScreen variant="page" />
      ) : courses.length === 0 ? (
        <EmptyState
          message="لسه مفيش كورسات"
          hint="اضغط «كورس جديد» عشان تنشئ أول كورس."
        />
      ) : (
        <>
          <label className="flex w-fit items-center gap-2 text-sm font-bold text-muted-foreground">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleVisibleCourses}
              className="size-4 accent-primary"
            />
            تحديد كل الكورسات الظاهرة
          </label>
          <div
            aria-busy={isLoading}
            className={isLoading ? "brand-loader--refreshing grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}
          >
          {courses.map((course) => (
            <div
              key={course._id}
              className={`flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft ${selectedCourseIds.has(course._id) ? "border-primary/60 bg-primary/5" : "border-border"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-extrabold text-foreground">
                    {course.title}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {course.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PublishStatus published={course.isPublished} />
                  <input type="checkbox" checked={selectedCourseIds.has(course._id)} onChange={() => toggleCourseSelection(course._id)} aria-label={`تحديد ${course.title}`} className="size-4 shrink-0 accent-primary" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StageBadge stage={course.stage} />
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                  {course.price > 0 ? `${course.price} ج.م` : "مجاني"}
                </span>
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                  {course.publishedLessonsCount}/{course.lessonsCount} درس
                </span>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-3">
                <Link
                  href={`/admin/courses/${course._id}`}
                  className="min-h-[38px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-center text-xs font-bold text-foreground hover:bg-muted"
                >
                  تعديل + الدروس
                </Link>
                <button
                  type="button"
                  onClick={() => togglePublish(course)}
                  className="min-h-[38px] rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                >
                  {course.isPublished ? "إخفاء" : "نشر"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteCourse(course)}
                  className="min-h-[38px] rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-500/20"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
