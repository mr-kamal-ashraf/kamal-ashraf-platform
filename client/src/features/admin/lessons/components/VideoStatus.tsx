import type { Lesson } from "@/api/types";
import { isVideoPending } from "../videoReadiness";

const CHIP =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold";

/**
 * A lesson's video at a glance: none yet, being prepared (a spinner, how far
 * along, and a small bar that fills), ready, or broken. The page keeps it up
 * to date (useVideoWatch) and passes how far along it is.
 */
export function VideoStatus({
  lesson,
  progress,
}: {
  lesson: Pick<Lesson, "bunnyVideoId" | "videoStatus">;
  /** 0–100 while the video is being prepared, when known. */
  progress?: number | null;
}) {
  if (!lesson.bunnyVideoId) {
    return <span className={`${CHIP} bg-amber-500/10 text-amber-600`}>مفيش فيديو</span>;
  }
  if (lesson.videoStatus === "failed") {
    return (
      <span className={`${CHIP} bg-red-500/10 text-red-600`}>
        الفيديو فيه مشكلة — ارفعه تاني
      </span>
    );
  }
  if (isVideoPending(lesson)) {
    return (
      <span role="status" className={`${CHIP} bg-sky-500/10 text-sky-700 dark:text-sky-300`}>
        <span
          aria-hidden
          className="size-3 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-600"
        />
        {lesson.videoStatus === "processing" ? "الفيديو بيتجهز" : "بنتأكد من الفيديو"}
        {progress ? (
          <>
            <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-sky-500/20">
              <span
                className="absolute inset-0 origin-right rounded-full bg-sky-500 transition-transform duration-700"
                style={{ transform: `scaleX(${Math.min(100, Math.max(4, progress)) / 100})` }}
              />
            </span>
            <bdi>{progress}%</bdi>
          </>
        ) : (
          <span aria-hidden>…</span>
        )}
      </span>
    );
  }
  return <span className={`${CHIP} bg-emerald-500/10 text-emerald-600`}>✓ الفيديو جاهز</span>;
}
