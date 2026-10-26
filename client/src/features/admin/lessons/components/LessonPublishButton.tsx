"use client";

import { useState } from "react";
import { toast } from "sonner";
import { adminLessonsApi, isApiError } from "@/api";
import type { Lesson } from "@/api/types";
import { cn } from "@/shared/lib/cn";
import { isVideoPending, publishBlockedReason } from "../videoReadiness";

type PublishFields = Pick<
  Lesson,
  "_id" | "isPublished" | "publishWhenReady" | "bunnyVideoId" | "videoStatus"
>;

/**
 * The one publish control for a lesson, everywhere it's listed:
 *   published            → «إخفاء»
 *   no video / broken    → «نشر», locked (the reason on hover)
 *   video being prepared → «انشره أول ما يجهز»: published by itself once ready
 *   waiting for it       → "هيتنشر لوحده أول ما يجهز" + «إلغاء»
 *   ready                → «نشر»
 * `onChange` gets the lesson as the server now has it.
 */
export function LessonPublishButton({
  lesson,
  onChange,
  size = "sm",
  onLessonPage = false,
}: {
  lesson: PublishFields;
  onChange: (lesson: Lesson) => void;
  size?: "sm" | "md";
  onLessonPage?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const blocked = publishBlockedReason(lesson, { onLessonPage });
  const waiting = !lesson.isPublished && !!lesson.publishWhenReady;

  async function run(publish: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      // Publishing never refuses a video still being prepared: it waits for it.
      const { lesson: updated } = await adminLessonsApi.togglePublish(lesson._id, publish, {
        whenReady: publish,
      });
      onChange(updated);
      toast.success(
        publish
          ? updated.isPublished
            ? "الدرس اتنشر للطلاب ✓"
            : "تمام — هيتنشر لوحده أول ما الفيديو يجهز"
          : waiting
            ? "اتلغى النشر التلقائي — الدرس هيفضل مخفي"
            : "الدرس اتخفى عن الطلاب",
      );
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    } finally {
      setBusy(false);
    }
  }

  const box = size === "md" ? "min-h-[44px] px-4 text-sm" : "min-h-[34px] px-3 text-xs";
  const base = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    box,
  );

  if (lesson.isPublished) {
    return (
      <button
        type="button"
        onClick={() => run(false)}
        disabled={busy}
        className={cn(base, "border border-border bg-card text-foreground hover:bg-muted")}
      >
        إخفاء
      </button>
    );
  }

  if (waiting) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-lg bg-sky-500/10 ps-3 font-bold text-sky-700 dark:text-sky-300",
          box,
        )}
      >
        <ClockIcon />
        هيتنشر لوحده أول ما يجهز
        <button
          type="button"
          onClick={() => run(false)}
          disabled={busy}
          className="rounded-md px-2 py-1 underline underline-offset-2 hover:bg-sky-500/10 disabled:opacity-50"
        >
          إلغاء
        </button>
      </span>
    );
  }

  if (blocked) {
    return (
      <button
        type="button"
        disabled
        title={blocked}
        className={cn(base, "border border-border bg-card text-foreground")}
      >
        نشر
      </button>
    );
  }

  if (isVideoPending(lesson)) {
    return (
      <button
        type="button"
        onClick={() => run(true)}
        disabled={busy}
        title="الفيديو لسه بيتجهز — الدرس هيتنشر للطلاب لوحده أول ما يخلص"
        className={cn(base, "bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 dark:text-sky-300")}
      >
        <ClockIcon />
        انشره أول ما يجهز
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => run(true)}
      disabled={busy}
      className={cn(base, "bg-emerald-600 text-white hover:bg-emerald-700")}
    >
      نشر
    </button>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
