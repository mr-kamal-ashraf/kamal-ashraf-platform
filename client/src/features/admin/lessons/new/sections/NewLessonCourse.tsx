"use client";

import { useState } from "react";
import Link from "next/link";
import { INPUT_CLASS } from "@/features/admin/shared/form/styles";
import { cn } from "@/shared/lib/cn";
import { useNewLesson } from "../NewLessonProvider";

/**
 * Which course the lesson goes in. Coming from a course's page it's simply
 * said (with a way to change it); otherwise it's the first thing asked.
 */
export function NewLessonCourse() {
  const { courses, courseId, courseFromLink, setCourseId, errors } = useNewLesson();
  const [changing, setChanging] = useState(false);

  if (courses === null) {
    return <div className="h-[72px] animate-pulse rounded-2xl border border-border bg-card" />;
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700">
        لسه مفيش كورسات — الدرس لازم يبقى جوا كورس.{" "}
        <Link href="/admin/courses/new" className="font-bold underline">
          اعمل كورس الأول
        </Link>
      </div>
    );
  }

  const course = courses.find((c) => c._id === courseId);
  if (course && courseFromLink && !changing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
        <p className="text-sm text-muted-foreground">
          الدرس هيتضاف لكورس <span className="font-extrabold text-foreground">{course.title}</span>
          <span className="ms-2 text-xs">— رقم {course.lessonsCount + 1} في الترتيب</span>
        </p>
        {courses.length > 1 && (
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-primary/10"
          >
            تغيير
          </button>
        )}
      </div>
    );
  }

  return (
    <label
      data-invalid={errors.courseId ? "true" : undefined}
      className="block rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6"
    >
      <span className="mb-1.5 block text-base font-extrabold text-foreground">الكورس</span>
      <span className="mb-3 block text-xs text-muted-foreground">
        الدرس هيتضاف جوا الكورس ده وياخد مرحلته.
      </span>
      <select
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        className={cn(INPUT_CLASS, errors.courseId && "border-destructive")}
      >
        <option value="" disabled>
          اختار الكورس...
        </option>
        {courses.map((c) => (
          <option key={c._id} value={c._id}>
            {c.title}
          </option>
        ))}
      </select>
      {errors.courseId && (
        <span role="alert" className="mt-1.5 block text-xs font-semibold text-destructive">
          {errors.courseId}
        </span>
      )}
    </label>
  );
}
