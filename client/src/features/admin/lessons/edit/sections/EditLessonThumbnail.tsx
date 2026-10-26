"use client";

import { resolveAssetUrl } from "@/config/env";
import { ImagePicker } from "@/features/admin/shared/form/ImagePicker";
import { Panel } from "@/features/admin/shared/form/Panel";
import { useEditLesson } from "../EditLessonProvider";

/** The lesson's picture — saved the moment it's picked. */
export function EditLessonThumbnail() {
  const { lesson, uploadingThumbnail, uploadThumbnail, clearThumbnail } = useEditLesson();
  if (!lesson) return null;

  return (
    <Panel title="صورة الدرس" optional hint="بتظهر على كارت الدرس — وبتتحفظ أول ما تختارها.">
      <ImagePicker
        imageUrl={resolveAssetUrl(lesson.thumbnail)}
        onFile={uploadThumbnail}
        onClear={lesson.thumbnail ? clearThumbnail : undefined}
        busy={uploadingThumbnail}
      />
    </Panel>
  );
}
