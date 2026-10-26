"use client";

import { CourseCardPublic } from "@/features/courses/CourseCardPublic";
import type { CourseFormValues } from "./CourseFields";

/**
 * The course card exactly as students will see it, filled in as the teacher
 * types — so it's clear where each field shows up. Not clickable.
 */
export function CoursePreview({
  values,
  imageUrl,
  lessonsCount = 0,
}: {
  values: CourseFormValues;
  imageUrl: string | null;
  lessonsCount?: number;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-muted-foreground">هيظهر للطلاب كده:</p>
      <div inert className="pointer-events-none select-none">
        <CourseCardPublic
          course={{
            _id: "preview",
            slug: "preview",
            title: values.title.trim() || "اسم الكورس",
            description: values.description.trim() || "الوصف القصير هيظهر هنا.",
            stage: values.stage,
            price: values.price,
            thumbnail: imageUrl,
            thumbnailGradient: null,
            lessonsCount,
          }}
        />
      </div>
    </div>
  );
}
