"use client";

import { useEditLesson } from "../EditLessonProvider";

export function EditLessonHeader() {
  const { lesson, togglePublish, deleteLesson } = useEditLesson();
  if (!lesson) return null;

  // Publishing waits for a video students can actually play (the server
  // refuses it too).
  const publishBlockedBy = lesson.isPublished
    ? null
    : !lesson.bunnyVideoId
      ? "ارفع فيديو الدرس من الأسفل الأول، بعدها تقدر تنشره للطلاب"
      : lesson.videoStatus === "failed"
        ? "الفيديو فيه مشكلة ومش هيشتغل — ارفعه تاني من الأسفل"
        : lesson.videoStatus !== "ready"
          ? "الفيديو لسه بيتجهز — هتقدر تنشر الدرس أول ما يخلص"
          : null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="wrap-break-word text-xl font-extrabold text-foreground sm:text-2xl">
          تعديل: {lesson.title}
        </h1>
        <p className="text-[11px] text-muted-foreground sm:text-xs" dir="ltr">
          {lesson.slug}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={togglePublish}
          disabled={!!publishBlockedBy}
          title={publishBlockedBy ?? undefined}
          className={`min-h-[44px] flex-1 rounded-lg px-4 py-2 text-sm font-bold sm:flex-initial disabled:cursor-not-allowed disabled:opacity-50 ${
            lesson.isPublished
              ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25"
              : "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
          }`}
        >
          {lesson.isPublished ? "إخفاء الدرس" : "نشر الدرس"}
        </button>
        <button
          type="button"
          onClick={deleteLesson}
          className="min-h-[44px] flex-1 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-500/25 sm:flex-initial"
        >
          حذف الدرس
        </button>
      </div>
    </div>
  );
}
