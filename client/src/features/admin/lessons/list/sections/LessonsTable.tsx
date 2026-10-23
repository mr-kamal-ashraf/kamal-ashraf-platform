"use client";

import Link from "next/link";
import { STAGE_LABELS } from "@/shared/lib/stage";
import { useLessonsList } from "../LessonsListProvider";
import { LessonAdminCard } from "../components/LessonAdminCard";
import { PublishStatus } from "../../components/PublishStatus";
import { VideoStatus } from "../../components/VideoStatus";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

export function LessonsTable() {
  const {
    isLoading,
    data,
    togglePublish,
    deleteLesson,
    isLessonSelected,
    toggleLessonSelection,
    toggleVisibleLessons,
  } = useLessonsList();

  // First load: the full loading screen. A reload (search / filter / page)
  // keeps the current rows up, dimmed, until the new ones arrive.
  if (isLoading && !data) return <LoadingScreen variant="page" />;

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
        مفيش دروس. اضغط &quot;درس جديد&quot; عشان تبدأ
      </div>
    );
  }

  return (
    <div
      aria-busy={isLoading}
      className={isLoading ? "brand-loader--refreshing space-y-5 sm:space-y-6" : "space-y-5 sm:space-y-6"}
    >
      <ul className="grid gap-3 lg:hidden">
        {data.items.map((lesson) => (
          <li key={lesson._id}>
            <LessonAdminCard
              lesson={lesson}
              onTogglePublish={() => togglePublish(lesson)}
              onDelete={() => deleteLesson(lesson)}
              selected={isLessonSelected(lesson._id)}
              onToggleSelect={() => toggleLessonSelection(lesson._id)}
            />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      data.items.length > 0 &&
                      data.items.every((lesson) =>
                        isLessonSelected(lesson._id),
                      )
                    }
                    onChange={toggleVisibleLessons}
                    aria-label="تحديد أو إلغاء تحديد دروس الصفحة"
                    className="size-4 accent-primary"
                  />
                </th>
                <th className="px-4 py-3">العنوان</th>
                <th className="px-4 py-3">المرحلة</th>
                <th className="px-4 py-3">المدة</th>
                <th className="px-4 py-3">الفيديو</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((lesson) => (
                <tr
                  key={lesson._id}
                  className={`border-t border-border/60 transition-colors hover:bg-muted/30 ${
                    isLessonSelected(lesson._id) ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isLessonSelected(lesson._id)}
                      onChange={() => toggleLessonSelection(lesson._id)}
                      aria-label={`تحديد ${lesson.title}`}
                      className="size-4 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/lessons/${lesson._id}`}
                      className="font-bold text-primary hover:underline"
                    >
                      {lesson.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {lesson.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {STAGE_LABELS[lesson.stage]}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {lesson.durationMinutes} دقيقة
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <VideoStatus uploaded={!!lesson.bunnyVideoId} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <PublishStatus published={lesson.isPublished} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => togglePublish(lesson)}
                        disabled={!lesson.isPublished && !lesson.bunnyVideoId}
                        title={
                          !lesson.isPublished && !lesson.bunnyVideoId
                            ? "ارفع فيديو الدرس من صفحة التعديل قبل النشر"
                            : undefined
                        }
                        className="rounded-lg bg-muted px-2.5 py-1 font-bold hover:bg-muted-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {lesson.isPublished ? "إخفاء" : "نشر"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLesson(lesson)}
                        className="rounded-lg bg-red-500/10 px-2.5 py-1 font-bold text-red-600 hover:bg-red-500/20"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
