"use client";

import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { EditLessonProvider, useEditLesson } from "./EditLessonProvider";
import { EditLessonForm } from "./sections/EditLessonForm";
import { EditLessonHeader } from "./sections/EditLessonHeader";
import { EditLessonThumbnail } from "./sections/EditLessonThumbnail";
import { EditLessonVideo } from "./sections/EditLessonVideo";

function EditLessonContent() {
  const { isLoading, error, lesson, deleteLesson } = useEditLesson();

  if (isLoading) return <LoadingScreen variant="page" />;
  if (error || !lesson) return <ErrorBox message={error || "الدرس غير موجود"} />;

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <EditLessonHeader />
      <EditLessonVideo />
      <EditLessonForm />
      <EditLessonThumbnail />
      <div className="flex justify-end border-t border-border/60 pt-4">
        <button
          type="button"
          onClick={deleteLesson}
          className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10"
        >
          حذف الدرس
        </button>
      </div>
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
