"use client";

import { BackLink } from "@/features/admin/shared/BackLink";
import { LessonPublishButton } from "../../components/LessonPublishButton";
import { PublishStatus } from "../../components/PublishStatus";
import { VideoStatus } from "../../components/VideoStatus";
import { useEditLesson } from "../EditLessonProvider";

/** The lesson, its course (the way back), its state, and publish. */
export function EditLessonHeader() {
  const { lesson, courses, videoProgress, setLesson } = useEditLesson();
  if (!lesson) return null;
  const course = courses.find((c) => c._id === lesson.courseId);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <BackLink href={`/admin/courses/${lesson.courseId}`}>
          {course ? course.title : "صفحة الكورس"}
        </BackLink>
        <h1 className="mt-1 wrap-break-word text-xl font-extrabold text-foreground sm:text-2xl">
          {lesson.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PublishStatus published={lesson.isPublished} />
          <VideoStatus lesson={lesson} progress={videoProgress} />
        </div>
      </div>
      <LessonPublishButton lesson={lesson} onChange={setLesson} size="md" onLessonPage />
    </div>
  );
}
