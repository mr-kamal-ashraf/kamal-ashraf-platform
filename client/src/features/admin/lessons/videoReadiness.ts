"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { adminLessonsApi } from "@/api";
import type { Lesson, LessonVideoStatus } from "@/api/types";

/*
 * A lesson's video stays "being prepared" for a while after the upload (the
 * video service converts it). One place decides what that means for the
 * teacher — the lesson page, the course page's lesson list and the lessons
 * list all use it — so they never disagree.
 */

/** How often to ask whether the video has finished being prepared. */
export const VIDEO_CHECK_EVERY_MS = 8000;

type VideoFields = Pick<Lesson, "bunnyVideoId" | "videoStatus">;

/** Uploaded, but not known to be ready (or broken) yet. */
export function isVideoPending(lesson: VideoFields): boolean {
  return (
    !!lesson.bunnyVideoId &&
    lesson.videoStatus !== "ready" &&
    lesson.videoStatus !== "failed"
  );
}

/**
 * Why the lesson can't be published at all right now, in the teacher's words
 * — or null when it can (a video still being prepared can: it's published by
 * itself once ready). The server refuses the same cases. `onLessonPage`: the
 * upload box is right there, instead of on the lesson's page.
 */
export function publishBlockedReason(
  lesson: VideoFields & Pick<Lesson, "isPublished">,
  { onLessonPage = false }: { onLessonPage?: boolean } = {},
): string | null {
  if (lesson.isPublished) return null;
  const there = onLessonPage ? "هنا" : "من صفحة الدرس";
  if (!lesson.bunnyVideoId) return `ارفع فيديو الدرس ${there} الأول، بعدها تقدر تنشره للطلاب`;
  if (lesson.videoStatus === "failed") return `الفيديو فيه مشكلة ومش هيشتغل — ارفعه تاني ${there}`;
  return null;
}

/** The lesson with the latest word on its video (and whether it went live meanwhile). */
export function withVideoStatus<T extends Lesson>(lesson: T, video: LessonVideoStatus): T {
  return {
    ...lesson,
    videoStatus: video.videoStatus,
    videoDurationSeconds: video.videoDurationSeconds,
    durationMinutes: video.durationMinutes ?? lesson.durationMinutes,
    isPublished: video.isPublished ?? lesson.isPublished,
    publishWhenReady: video.publishWhenReady ?? null,
  };
}

type Watched = Pick<Lesson, "_id" | "title" | "bunnyVideoId" | "videoStatus" | "isPublished">;

/**
 * While any of these lessons' videos is being prepared, asks about each every
 * few seconds (only while the page is on screen) and hands every answer to
 * `onUpdate`. One watcher per page, however many places show the lesson. A
 * lesson that goes live by itself (published once ready) gets a notice.
 * Returns how far each one is (0–100) when the video service said.
 */
export function useVideoWatch(
  lessons: readonly Watched[],
  onUpdate: (lessonId: string, video: LessonVideoStatus) => void,
): Record<string, number | null> {
  const [progress, setProgress] = useState<Record<string, number | null>>({});
  const latest = useRef({ lessons, onUpdate });
  useEffect(() => {
    latest.current = { lessons, onUpdate };
  });

  const pendingKey = lessons
    .filter(isVideoPending)
    .map((l) => l._id)
    .join(",");

  useEffect(() => {
    if (!pendingKey) return;
    const ids = pendingKey.split(",");
    let cancelled = false;
    let timer = 0;
    const check = async () => {
      if (document.visibilityState === "visible") {
        await Promise.all(
          ids.map(async (id) => {
            try {
              const video = await adminLessonsApi.videoStatus(id);
              if (cancelled) return;
              const before = latest.current.lessons.find((l) => l._id === id);
              if (video.isPublished && before && !before.isPublished) {
                toast.success(`«${before.title}» اتنشر للطلاب — الفيديو جهز ✓`);
              }
              setProgress((p) => ({ ...p, [id]: video.encodeProgress }));
              latest.current.onUpdate(id, video);
            } catch {
              /* try again next round */
            }
          }),
        );
      }
      // Lessons that finished leave the list (pendingKey changes) and this
      // round ends; the rest are asked again.
      if (!cancelled) timer = window.setTimeout(check, VIDEO_CHECK_EVERY_MS);
    };
    // The first answer comes quickly (a list may hold a status never checked).
    timer = window.setTimeout(check, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pendingKey]);

  return progress;
}
