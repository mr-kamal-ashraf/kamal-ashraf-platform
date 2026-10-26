import Link from "next/link";
import type { CourseAdminItem } from "@/api/types";
import { PublishStatus } from "@/features/admin/lessons/components/PublishStatus";
import { StageBadge } from "@/shared/ui/StageBadge";
import {
  nextStepText,
  priceText,
  publishLockedReason,
  type CourseRowActions,
} from "../courseRow";

/** A course on a phone (the table is for wide screens). */
export function CourseAdminCard({
  course,
  actions,
}: {
  course: CourseAdminItem;
  actions: CourseRowActions;
}) {
  const selected = actions.isSelected(course._id);
  const nextStep = nextStepText(course);
  const locked = publishLockedReason(course);

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft ${selected ? "border-primary/60 bg-primary/5" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/admin/courses/${course._id}`} className="min-w-0">
          <h3 className="truncate text-sm font-extrabold text-primary hover:underline">
            {course.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {course.description}
          </p>
        </Link>
        <div className="flex items-center gap-2">
          <PublishStatus published={course.isPublished} />
          <input
            type="checkbox"
            checked={selected}
            onChange={() => actions.onToggleSelect(course._id)}
            aria-label={`تحديد ${course.title}`}
            className="size-4 shrink-0 accent-primary"
          />
        </div>
      </div>

      {nextStep && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-700">
          {nextStep}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <StageBadge stage={course.stage} />
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
          {priceText(course)}
        </span>
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
          {course.lessonsCount} درس · {course.publishedLessonsCount} منشور
        </span>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Link
          href={`/admin/courses/${course._id}`}
          className="min-h-[38px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-center text-xs font-bold text-foreground hover:bg-muted"
        >
          افتح الكورس
        </Link>
        <button
          type="button"
          onClick={() => actions.onTogglePublish(course)}
          disabled={!!locked}
          title={locked ?? undefined}
          className="min-h-[38px] rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {course.isPublished ? "إخفاء" : "نشر"}
        </button>
        <button
          type="button"
          onClick={() => actions.onDelete(course)}
          className="min-h-[38px] rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-500/20"
        >
          حذف
        </button>
      </div>
    </div>
  );
}
