import Link from "next/link";
import type { Lesson } from "@/api/types";
import { STAGE_LABELS } from "@/shared/lib/stage";
import { PublishStatus } from "../../components/PublishStatus";
import { VideoStatus } from "../../components/VideoStatus";

interface LessonAdminCardProps {
  lesson: Lesson;
  onTogglePublish: () => void;
  onDelete: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}

export function LessonAdminCard({
  lesson,
  onTogglePublish,
  onDelete,
  selected,
  onToggleSelect,
}: LessonAdminCardProps) {
  return (
    <div
      className={`rounded-2xl border bg-card p-4 shadow-soft ${
        selected ? "border-primary/60 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <Link href={`/admin/lessons/${lesson._id}`} className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-primary hover:underline">
            {lesson.title}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {lesson.slug}
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <PublishStatus published={lesson.isPublished} />
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`تحديد ${lesson.title}`}
            className="size-4 shrink-0 accent-primary"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full border border-border bg-background px-2.5 py-0.5 font-bold">
          {STAGE_LABELS[lesson.stage]}
        </span>
        <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-muted-foreground">
          {lesson.durationMinutes} دقيقة
        </span>
        <VideoStatus uploaded={!!lesson.bunnyVideoId} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Link
          href={`/admin/lessons/${lesson._id}`}
          className="min-h-[40px] flex-1 rounded-lg bg-primary/10 px-3 py-2 text-center text-xs font-bold text-primary hover:bg-primary/15"
        >
          تفاصيل
        </Link>
        <button
          type="button"
          onClick={onTogglePublish}
          disabled={!lesson.isPublished && !lesson.bunnyVideoId}
          title={
            !lesson.isPublished && !lesson.bunnyVideoId
              ? "ارفع فيديو الدرس من صفحة التعديل قبل النشر"
              : undefined
          }
          className="min-h-[40px] flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-bold hover:bg-muted-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {lesson.isPublished ? "إخفاء" : "نشر"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="min-h-[40px] rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-500/20"
        >
          حذف
        </button>
      </div>
    </div>
  );
}
