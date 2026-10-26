import Link from "next/link";
import type { CourseAdminItem } from "@/api/types";
import { PublishStatus } from "@/features/admin/lessons/components/PublishStatus";
import { STAGE_LABELS } from "@/shared/lib/stage";
import { CourseAdminCard } from "../components/CourseAdminCard";
import {
  nextStepText,
  priceText,
  publishLockedReason,
  type CourseRowActions,
} from "../courseRow";

/**
 * The courses as a table on wide screens — like the lessons list — and as
 * cards on phones.
 */
export function CoursesTable({
  courses,
  actions,
  allSelected,
  onToggleAll,
  refreshing,
}: {
  courses: CourseAdminItem[];
  actions: CourseRowActions;
  allSelected: boolean;
  onToggleAll: () => void;
  /** A search / filter reload: the rows stay, dimmed. */
  refreshing: boolean;
}) {
  return (
    <div
      aria-busy={refreshing}
      className={refreshing ? "brand-loader--refreshing space-y-3" : "space-y-3"}
    >
      <div className="space-y-3 lg:hidden">
        <label className="flex w-fit items-center gap-2 text-sm font-bold text-muted-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            className="size-4 accent-primary"
          />
          تحديد كل الكورسات الظاهرة
        </label>
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course._id}>
              <CourseAdminCard course={course} actions={actions} />
            </li>
          ))}
        </ul>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    aria-label="تحديد أو إلغاء تحديد كل الكورسات الظاهرة"
                    className="size-4 accent-primary"
                  />
                </th>
                <th className="px-4 py-3">الكورس</th>
                <th className="px-4 py-3">المرحلة</th>
                <th className="px-4 py-3">السعر</th>
                <th className="px-4 py-3">الدروس</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => {
                const selected = actions.isSelected(course._id);
                const nextStep = nextStepText(course);
                const locked = publishLockedReason(course);
                return (
                  <tr
                    key={course._id}
                    className={`border-t border-border/60 align-top transition-colors hover:bg-muted/30 ${selected ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => actions.onToggleSelect(course._id)}
                        aria-label={`تحديد ${course.title}`}
                        className="size-4 accent-primary"
                      />
                    </td>
                    <td className="min-w-[16rem] max-w-md px-4 py-3">
                      <Link
                        href={`/admin/courses/${course._id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {course.title}
                      </Link>
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {course.description}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {STAGE_LABELS[course.stage]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-bold">
                      {priceText(course)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {course.lessonsCount} درس
                      <span className="text-muted-foreground"> · {course.publishedLessonsCount} منشور</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <PublishStatus published={course.isPublished} />
                      {nextStep && (
                        <div className="mt-1.5 max-w-[14rem] text-[11px] font-semibold text-amber-700">
                          {nextStep}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {/* The name opens the course, as in the lessons list. */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => actions.onTogglePublish(course)}
                          disabled={!!locked}
                          title={locked ?? undefined}
                          className={`min-h-[34px] rounded-lg px-3 font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
                            course.isPublished || locked
                              ? "border border-border bg-card text-foreground hover:bg-muted"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {course.isPublished ? "إخفاء" : "نشر"}
                        </button>
                        <button
                          type="button"
                          onClick={() => actions.onDelete(course)}
                          className="min-h-[34px] rounded-lg bg-red-500/10 px-3 font-bold text-red-600 hover:bg-red-500/20"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
