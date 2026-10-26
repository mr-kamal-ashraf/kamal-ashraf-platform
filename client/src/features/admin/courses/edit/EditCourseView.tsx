"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { adminCoursesApi, adminLessonsApi, isApiError } from "@/api";
import type { Course, Lesson } from "@/api/types";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { CourseCodesSection } from "./CourseCodesSection";
import { CourseDetailsPanel } from "./sections/CourseDetailsPanel";
import { CourseHeader } from "./sections/CourseHeader";
import { CourseLessonsPanel } from "./sections/CourseLessonsPanel";
import { CoursePublishSteps } from "./sections/CoursePublishSteps";
import { useCoursePublish } from "./useCoursePublish";

/**
 * A course's page: where it stands and what's next (until it's published),
 * its lessons in order, its details, and its codes.
 */
export function EditCourseView({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ course: c }, lessonsRes] = await Promise.all([
        adminCoursesApi.get(courseId),
        adminLessonsApi.list({ courseId, limit: 100 }),
      ]);
      setCourse(c);
      setLessons(lessonsRes.items);
    } catch (err) {
      const message = isApiError(err) ? err.message : "حصل خطأ";
      setError(message);
      toast.error(message);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !course) return <ErrorBox message={error} />;
  if (!course) return <LoadingScreen variant="page" />;
  return <CourseHub course={course} setCourse={setCourse} lessons={lessons} setLessons={setLessons} />;
}

function CourseHub({
  course,
  setCourse,
  lessons,
  setLessons,
}: {
  course: Course;
  setCourse: (course: Course) => void;
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
}) {
  const publish = useCoursePublish(course, lessons, setCourse);

  return (
    <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
      <CourseHeader course={course} lessons={lessons} publish={publish} />
      {!course.isPublished && (
        <CoursePublishSteps course={course} lessons={lessons} publish={publish} />
      )}
      <CourseLessonsPanel courseId={course._id} lessons={lessons} setLessons={setLessons} />
      <CourseDetailsPanel course={course} onCourse={setCourse} />
      <CourseCodesSection
        courseId={course._id}
        coursePrice={course.price}
        published={course.isPublished}
      />
    </div>
  );
}
