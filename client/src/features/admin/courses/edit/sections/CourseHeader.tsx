import type { Course, Lesson } from "@/api/types";
import { PublishStatus } from "@/features/admin/lessons/components/PublishStatus";
import { BackLink } from "@/features/admin/shared/BackLink";
import { cn } from "@/shared/lib/cn";
import { StageBadge } from "@/shared/ui/StageBadge";
import type { CoursePublish } from "../useCoursePublish";

/** The course at a glance: name, state, stage, price, lessons — and publish. */
export function CourseHeader({
  course,
  lessons,
  publish,
}: {
  course: Course;
  lessons: readonly Lesson[];
  publish: CoursePublish;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <BackLink href="/admin/courses">الكورسات</BackLink>
        <h1 className="mt-1 wrap-break-word text-xl font-extrabold text-foreground sm:text-2xl">
          {course.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PublishStatus published={course.isPublished} />
          <StageBadge stage={course.stage} />
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            {course.price > 0 ? `${course.price} جنيه` : "مجاني"}
          </span>
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
            {lessons.length} درس · {publish.publishedLessons} منشور
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {course.isPublished && (
          <a
            href={`/courses/${course.slug}`}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-muted"
          >
            افتح صفحته زي الطالب ↗
          </a>
        )}
        <button
          type="button"
          onClick={publish.toggle}
          disabled={publish.busy || !!publish.blockedReason}
          title={publish.blockedReason ?? undefined}
          className={cn(
            "inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            course.isPublished
              ? "border border-border bg-card text-foreground hover:bg-muted"
              : "bg-emerald-600 text-white hover:bg-emerald-700",
          )}
        >
          {course.isPublished ? "إخفاء الكورس" : "انشر الكورس"}
        </button>
      </div>
    </div>
  );
}
