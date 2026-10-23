"use client";

import { useExamGenerator } from "../ExamGeneratorProvider";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import type { GeneratedExam } from "@/api";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

/** Short Arabic date like "٢ أكتوبر ٢٠٢٦". */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

const ROW_BTN =
  "min-h-[34px] rounded-lg border px-3 text-xs font-bold transition-colors";

/**
 * The teacher's saved library — rendered as the body of the "المحفوظة" panel.
 * The panel owns the title/count and the scroll; this just lays out the rows.
 */
export function SavedExamsList() {
  const { savedExams, savedLoading, openSavedExam, deleteSavedExam } =
    useExamGenerator();
  const confirm = useConfirm();

  const handlePrint = (exam: GeneratedExam) => {
    openSavedExam(exam);
    window.setTimeout(() => window.print(), 400);
  };

  const handleDelete = async (exam: GeneratedExam) => {
    const ok = await confirm({
      title: "حذف الامتحان",
      message: `متأكد إنك عايز تمسح «${exam.title}»؟ مش هينفع ترجعه بعد كده.`,
      confirmLabel: "امسح",
      cancelLabel: "إلغاء",
      tone: "danger",
    });
    if (ok) await deleteSavedExam(exam.id);
  };

  if (savedLoading) {
    return (
      <LoadingScreen className="rounded-none border-0 bg-transparent py-10" />
    );
  }

  if (savedExams.length === 0) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center gap-1.5 text-center">
        <p className="text-sm font-bold text-foreground">لسه مفيش امتحانات</p>
        <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
          أول ما تولّد امتحان هيتحفظ هنا تلقائي وترجعله في أي وقت.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {savedExams.map((exam) => (
        <li
          key={exam.id}
          className="rounded-xl border border-border bg-background/60 p-3.5 transition-colors hover:border-primary/30"
        >
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                exam.kind === "quiz"
                  ? "bg-amber-500/10 text-amber-600"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {exam.kind === "quiz" ? "كويز" : "امتحان"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {exam.stageLabel} · {exam.questionCount} سؤال
            </span>
            <span className="ms-auto text-[11px] text-muted-foreground">
              {formatDate(exam.createdAt)}
            </span>
          </div>

          <h3 className="mt-1.5 line-clamp-1 text-sm font-bold text-foreground">
            {exam.title}
          </h3>
          {exam.topics ? (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/80">
              {exam.topics}
            </p>
          ) : null}

          <div className="mt-2.5 flex gap-1.5">
            <button
              type="button"
              onClick={() => openSavedExam(exam)}
              className={`${ROW_BTN} flex-1 border-border hover:border-primary/40 hover:text-primary`}
            >
              فتح
            </button>
            <button
              type="button"
              onClick={() => handlePrint(exam)}
              className={`${ROW_BTN} flex-1 border-border hover:border-primary/40 hover:text-primary`}
            >
              طباعة
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(exam)}
              className={`${ROW_BTN} border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive`}
            >
              حذف
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
