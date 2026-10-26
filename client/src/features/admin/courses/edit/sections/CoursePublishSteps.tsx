import type { ReactNode } from "react";
import Link from "next/link";
import type { Course, Lesson } from "@/api/types";
import { cn } from "@/shared/lib/cn";
import type { CoursePublish } from "../useCoursePublish";

interface Step {
  title: string;
  done: boolean;
  text: string;
  action?: ReactNode;
}

/**
 * Until the course is out: the way there, step by step, with what's done,
 * what's next (and its button) — so nothing has to be remembered.
 */
export function CoursePublishSteps({
  course,
  lessons,
  publish,
}: {
  course: Course;
  lessons: readonly Lesson[];
  publish: CoursePublish;
}) {
  const { publishedLessons, waitingLessons } = publish;
  const steps: Step[] = [
    {
      title: "بيانات الكورس",
      done: true,
      text: "الاسم والمرحلة والسعر — اتسجلوا.",
    },
    {
      title: "ضيف الدروس",
      done: lessons.length > 0,
      text:
        lessons.length > 0
          ? `في الكورس ${lessons.length} درس — تقدر تضيف كمان في أي وقت.`
          : "لكل درس: ارفع الفيديو واكتب اسمه.",
      action: (
        <Link
          href={`/admin/lessons/new?courseId=${course._id}`}
          className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-gradient-brand px-4 text-xs font-bold text-primary-foreground shadow-brand"
        >
          + ضيف درس
        </Link>
      ),
    },
    {
      title: "انشر الدروس",
      done: publishedLessons > 0,
      text:
        publishedLessons > 0
          ? `${publishedLessons} درس منشور.`
          : waitingLessons > 0
            ? `${waitingLessons} درس هيتنشر لوحده أول ما الفيديو يجهز.`
            : "دوس «نشر» جنب الدرس — أو «انشره أول ما يجهز» لو الفيديو لسه بيتجهز.",
    },
    {
      title: "انشر الكورس",
      done: course.isPublished,
      text: "عشان يظهر للطلاب ويقدروا يشتركوا فيه.",
      action: (
        <button
          type="button"
          onClick={publish.toggle}
          disabled={publish.busy || !!publish.blockedReason}
          className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          انشر الكورس
        </button>
      ),
    },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <section
      aria-labelledby="publish-steps-title"
      className="rounded-2xl border border-primary/25 bg-card p-4 shadow-soft sm:p-6"
    >
      <h2 id="publish-steps-title" className="text-base font-extrabold text-foreground">
        خطوات نشر الكورس
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        الكورس لسه مخفي عن الطلاب. الخطوة اللي عليها الدور متعلّمة.
      </p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => {
          const isCurrent = i === current;
          return (
            <li
              key={step.title}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-3",
                isCurrent ? "border-primary bg-primary/5" : "border-border bg-background",
                !step.done && !isCurrent && "opacity-60",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                    step.done
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground",
                  )}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                <span className="text-sm font-extrabold text-foreground">{step.title}</span>
                {step.done && <span className="sr-only">(خلصت)</span>}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{step.text}</p>
              {isCurrent && step.action && <div className="mt-auto pt-1">{step.action}</div>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
