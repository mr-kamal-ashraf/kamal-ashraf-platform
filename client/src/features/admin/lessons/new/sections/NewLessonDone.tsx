"use client";

import Link from "next/link";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/features/admin/shared/form/styles";
import { VideoStatus } from "../../components/VideoStatus";
import { useNewLesson } from "../NewLessonProvider";

/**
 * After the upload: what happens now, in plain words (with the video's live
 * state), and the two likely next moves — the next lesson, or the course.
 */
export function NewLessonDone() {
  const { saved, videoProgress, courses, startNext } = useNewLesson();
  if (!saved) return null;
  const course = courses?.find((c) => c._id === saved.courseId);

  const next = saved.isPublished
    ? "الدرس اتنشر للطلاب ✓"
    : saved.publishWhenReady
      ? "الفيديو بيتجهز دلوقتي (عادةً كام دقيقة) — وأول ما يخلص، الدرس هيتنشر للطلاب لوحده. تقدر تقفل الصفحة عادي."
      : "الفيديو بيتجهز دلوقتي (عادةً كام دقيقة). الدرس محفوظ مخفي — انشره من صفحة الكورس وقت ما تحب.";

  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-card p-5 text-center shadow-soft sm:p-8">
      <span
        aria-hidden
        className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600 text-2xl font-black text-white"
      >
        ✓
      </span>
      <h2 className="mt-4 text-lg font-extrabold text-foreground sm:text-xl">
        «{saved.title}» اتحفظ والفيديو اترفع
      </h2>
      <div className="mt-3 flex justify-center">
        <VideoStatus lesson={saved} progress={videoProgress} />
      </div>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{next}</p>
      {course && !course.isPublished && (
        <p className="mx-auto mt-3 max-w-lg rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700">
          الكورس نفسه لسه مخفي عن الطلاب — لما تخلص الدروس، انشره من صفحة الكورس.
        </p>
      )}
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" onClick={startNext} className={PRIMARY_BUTTON_CLASS}>
          + ضيف الدرس اللي بعده
        </button>
        <Link href={`/admin/courses/${saved.courseId}`} className={SECONDARY_BUTTON_CLASS}>
          ارجع لصفحة الكورس
        </Link>
      </div>
    </section>
  );
}
