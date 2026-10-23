"use client";

import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { useNewLesson } from "../NewLessonProvider";

export function NewLessonStatusBanner() {
  const { step, statusMessage } = useNewLesson();
  if (step !== "uploading") return null;

  // Saving can take minutes (the video upload): cover the page with what is
  // happening, so it never looks stuck and nothing gets clicked meanwhile.
  return (
    <LoadingScreen
      variant="overlay"
      label={statusMessage || "جارٍ الحفظ"}
      hint="ممكن ياخد كام دقيقة حسب حجم الفيديو — سيب الصفحة مفتوحة لحد ما يخلص."
    />
  );
}
