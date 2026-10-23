"use client";

import { useNewLesson } from "../NewLessonProvider";

export function NewLessonActions() {
  const { wizardStep, isLastStep, submitting, checking, statusMessage, prev } =
    useNewLesson();

  return (
    <div className="flex items-center gap-3 border-t border-border/60 pt-4">
      <button
        type="button"
        disabled={submitting}
        onClick={prev}
        className="min-h-[44px] rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-50"
      >
        {wizardStep === 0 ? "رجوع" : "السابق"}
      </button>
      <button
        type="submit"
        disabled={submitting || checking}
        className="min-h-[44px] flex-1 rounded-xl bg-gradient-brand px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-brand transition-transform hover:scale-[1.02] disabled:opacity-50 sm:flex-none"
      >
        {isLastStep
          ? submitting
            ? statusMessage || "جارٍ الحفظ..."
            : "حفظ الدرس"
          : checking
            ? "لحظة..."
            : "التالي"}
      </button>
    </div>
  );
}
