"use client";

import { useState } from "react";
import { toast } from "sonner";
import { adminCoursesApi, isApiError } from "@/api";
import type { Course, Lesson } from "@/api/types";

/**
 * Publishing a course: it needs at least one published lesson (the server
 * refuses an empty course too). Says why not, in the teacher's words.
 */
export function useCoursePublish(
  course: Course,
  lessons: readonly Lesson[],
  onCourse: (course: Course) => void,
) {
  const [busy, setBusy] = useState(false);
  const publishedLessons = lessons.filter((l) => l.isPublished).length;
  const waitingLessons = lessons.filter((l) => !l.isPublished && l.publishWhenReady).length;

  const blockedReason =
    course.isPublished || publishedLessons > 0
      ? null
      : lessons.length === 0
        ? "ضيف درس واحد على الأقل الأول"
        : waitingLessons > 0
          ? "استنى الدرس يتنشر — هيتنشر لوحده أول ما الفيديو يجهز"
          : "انشر درس واحد على الأقل الأول";

  async function toggle() {
    if (busy || blockedReason) return;
    setBusy(true);
    try {
      const { course: updated } = await adminCoursesApi.togglePublish(
        course._id,
        !course.isPublished,
      );
      onCourse(updated);
      toast.success(
        updated.isPublished ? "الكورس اتنشر — الطلاب يقدروا يشوفوه دلوقتي ✓" : "الكورس اتخفى عن الطلاب",
      );
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    } finally {
      setBusy(false);
    }
  }

  return { busy, blockedReason, publishedLessons, waitingLessons, toggle };
}

export type CoursePublish = ReturnType<typeof useCoursePublish>;
