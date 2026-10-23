"use client";

import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import {
  EditLessonProvider,
  useEditLesson,
} from "./EditLessonProvider";
import { EditLessonForm } from "./sections/EditLessonForm";
import { EditLessonHeader } from "./sections/EditLessonHeader";
import { EditLessonThumbnail } from "./sections/EditLessonThumbnail";
import { EditLessonVideo } from "./sections/EditLessonVideo";

function EditLessonContent() {
  const { isLoading, error, lesson } = useEditLesson();

  if (isLoading) return <LoadingScreen variant="page" />;
  if (error || !lesson) return <ErrorBox message={error || "الدرس غير موجود"} />;

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <EditLessonHeader />
      <EditLessonVideo />
      <EditLessonThumbnail />
      <EditLessonForm />
    </div>
  );
}

export function EditLessonView({ lessonId }: { lessonId: string }) {
  return (
    <EditLessonProvider lessonId={lessonId}>
      <EditLessonContent />
    </EditLessonProvider>
  );
}
