"use client";

import { toast } from "sonner";
import { useExamGenerator } from "../ExamGeneratorProvider";
import { ExamPaper } from "../components/ExamPaper";

/** Flattens the paper into plain text for pasting into Word or WhatsApp. */
function toPlainText(exam: ReturnType<typeof useExamGenerator>["exam"]): string {
  if (!exam) return "";
  const lines: string[] = [exam.stageLabel, ""];

  const letters = ["أ", "ب", "ج", "د", "هـ"];
  let questionNumber = 0;

  for (const section of exam.sections) {
    lines.push(section.title);
    for (const question of section.questions) {
      questionNumber += 1;
      lines.push(`${questionNumber}. ${question.prompt} (${question.marks} درجة)`);
      question.options.forEach((option, index) => {
        lines.push(`   ${letters[index] ?? "•"}) ${option}`);
      });
    }
    lines.push("");
  }

  if (exam.teacherName) lines.push(exam.teacherName);

  return lines.join("\n");
}

const TOOLBAR_BTN =
  "min-h-[38px] rounded-lg px-3.5 text-xs font-bold transition-colors";

export function ExamGeneratorResult() {
  const { exam, error, isGenerating, reset } = useExamGenerator();

  if (isGenerating && !exam) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
        <span className="size-7 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <p className="text-sm font-bold text-foreground">جاري توليد الورقة…</p>
        <p className="text-[11px] text-muted-foreground">
          بناخد المحتوى من المنهج وبنكتب الأسئلة — ثواني وتظهر هنا.
        </p>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className="flex min-h-[220px] items-center justify-center px-2 text-center text-sm font-semibold text-destructive">
        {error}
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-bold text-foreground">الورقة هتظهر هنا</p>
        <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
          املا الإعدادات والمحتوى واضغط «ولّد» — هتلاقي الورقة جاهزة للطباعة.
        </p>
      </div>
    );
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(exam));
      toast.success("تم نسخ الامتحان");
    } catch {
      toast.error("المتصفح مسمحش بالنسخ، جرّب تحدّد النص بنفسك");
    }
  };

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex flex-wrap items-center gap-2 border-b border-border/70 bg-card/95 px-4 py-2.5 backdrop-blur sm:-mx-5 sm:px-5 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className={`${TOOLBAR_BTN} bg-gradient-brand text-white`}
        >
          طباعة / حفظ PDF
        </button>
        <button
          type="button"
          onClick={() => void copyToClipboard()}
          className={`${TOOLBAR_BTN} border border-border hover:border-primary/40`}
        >
          نسخ النص
        </button>
        <button
          type="button"
          onClick={reset}
          className={`${TOOLBAR_BTN} ms-auto text-muted-foreground hover:text-destructive`}
        >
          إغلاق
        </button>
      </div>

      <ExamPaper exam={exam} />
    </div>
  );
}
