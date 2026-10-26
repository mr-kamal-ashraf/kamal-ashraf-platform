"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { adminLessonsApi, isApiError } from "@/api";
import type { Lesson, LessonVideoStatus } from "@/api/types";
import { LessonPublishButton } from "@/features/admin/lessons/components/LessonPublishButton";
import { PublishStatus } from "@/features/admin/lessons/components/PublishStatus";
import { VideoStatus } from "@/features/admin/lessons/components/VideoStatus";
import { useVideoWatch, withVideoStatus } from "@/features/admin/lessons/videoReadiness";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import { Panel } from "@/features/admin/shared/form/Panel";

const ICON_BUTTON =
  "flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

/** The duration students see — hidden while it waits for the video's length. */
function durationText(lesson: Lesson): string | null {
  if (lesson.durationAuto && !lesson.videoDurationSeconds) return null;
  return `${lesson.durationMinutes} دقيقة`;
}

/**
 * The course's lessons, numbered in the order students see them: their video
 * and publish state at a glance, publish / edit / delete, and arrows to
 * change the order.
 */
export function CourseLessonsPanel({
  courseId,
  lessons,
  setLessons,
}: {
  courseId: string;
  lessons: Lesson[];
  setLessons: (update: (prev: Lesson[]) => Lesson[]) => void;
}) {
  const confirm = useConfirm();
  const [moving, setMoving] = useState(false);

  const replace = useCallback(
    (updated: Lesson) => setLessons((prev) => prev.map((l) => (l._id === updated._id ? updated : l))),
    [setLessons],
  );
  const onVideo = useCallback(
    (id: string, video: LessonVideoStatus) =>
      setLessons((prev) => prev.map((l) => (l._id === id ? withVideoStatus(l, video) : l))),
    [setLessons],
  );
  const progress = useVideoWatch(lessons, onVideo);

  async function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (moving || target < 0 || target >= lessons.length) return;
    const before = lessons;
    const next = lessons.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setLessons(() => next);
    setMoving(true);
    try {
      await adminLessonsApi.reorder(courseId, next.map((l) => l._id));
    } catch (err) {
      setLessons(() => before);
      toast.error(isApiError(err) ? err.message : "مقدرناش نحفظ الترتيب — جرّب تاني.");
    } finally {
      setMoving(false);
    }
  }

  async function remove(lesson: Lesson) {
    if (
      !(await confirm({
        title: "حذف الدرس",
        message: `هيتحذف درس «${lesson.title}» والفيديو بتاعه. مفيش تراجع بعد كده.`,
        confirmLabel: "حذف",
        tone: "danger",
      }))
    )
      return;
    try {
      await adminLessonsApi.delete(lesson._id);
      setLessons((prev) => prev.filter((l) => l._id !== lesson._id));
      toast.success("الدرس اتحذف");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }

  return (
    <Panel
      title={`دروس الكورس${lessons.length ? ` (${lessons.length})` : ""}`}
      hint={
        lessons.length > 1
          ? "الترتيب هنا هو اللي الطالب بيشوفه — غيّره بالأسهم."
          : "كل درس = فيديو واسم. ضيف الدروس بالترتيب اللي عايز الطالب يشوفه."
      }
      aside={
        lessons.length > 0 ? (
          <Link
            href={`/admin/lessons/new?courseId=${courseId}`}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-gradient-brand px-4 text-xs font-bold text-primary-foreground shadow-brand"
          >
            + درس جديد
          </Link>
        ) : undefined
      }
    >
      {lessons.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-background px-4 py-10 text-center">
          <span aria-hidden className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="14" height="14" rx="3" />
              <path d="m16 10 6-3v10l-6-3z" />
            </svg>
          </span>
          <p className="text-sm font-extrabold text-foreground">لسه مفيش دروس في الكورس ده</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            ابدأ بأول درس: ارفع الفيديو واكتب اسمه — والباقي اختياري.
          </p>
          <Link
            href={`/admin/lessons/new?courseId=${courseId}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-brand px-6 text-sm font-bold text-primary-foreground shadow-brand"
          >
            + ضيف أول درس
          </Link>
        </div>
      ) : (
        <ol className="space-y-2">
          {lessons.map((lesson, i) => {
            const duration = durationText(lesson);
            return (
              <li
                key={lesson._id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-background p-3"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || moving}
                      aria-label={`حرّك «${lesson.title}» لفوق`}
                      className={ICON_BUTTON}
                    >
                      <svg aria-hidden className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m18 15-6-6-6 6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === lessons.length - 1 || moving}
                      aria-label={`حرّك «${lesson.title}» لتحت`}
                      className={ICON_BUTTON}
                    >
                      <svg aria-hidden className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-extrabold text-primary">
                    {i + 1}
                  </span>
                </div>

                <div className="min-w-0 flex-1 basis-48">
                  <Link
                    href={`/admin/lessons/${lesson._id}`}
                    className="block truncate text-sm font-bold text-foreground hover:text-primary"
                  >
                    {lesson.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <PublishStatus published={lesson.isPublished} />
                    <VideoStatus lesson={lesson} progress={progress[lesson._id]} />
                    {duration && <span>{duration}</span>}
                  </div>
                </div>

                <div className="ms-auto flex items-center gap-2">
                  <LessonPublishButton lesson={lesson} onChange={replace} />
                  <Link
                    href={`/admin/lessons/${lesson._id}`}
                    className="inline-flex min-h-[34px] items-center rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground hover:bg-muted"
                  >
                    تعديل
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(lesson)}
                    aria-label={`حذف «${lesson.title}»`}
                    title="حذف الدرس"
                    className="flex size-[34px] items-center justify-center rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20"
                  >
                    <svg aria-hidden className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
