import type { GeneratedExam } from "@/api";

/**
 * The generated paper.
 *
 * Two faces:
 *  - On SCREEN the teacher sees a full header (title, stage, time, marks) and
 *    the instructions, so the paper is easy to review.
 *  - On PRINT the sheet is deliberately bare: no title, just the stage at the
 *    top, then the questions straight away, and the teacher's name at the
 *    bottom-left. Nothing else. (See the print rules in styles.css that also
 *    strip the browser's own URL/date header.)
 *
 * There is no answer key — the platform never produces one.
 */
export function ExamPaper({ exam }: { exam: GeneratedExam }) {
  let questionNumber = 0;

  return (
    <article
      id="exam-paper"
      dir="rtl"
      className="break-words rounded-xl border border-border/60 bg-background p-5 text-foreground sm:p-6"
    >
      {/* Screen-only header — hidden when printing. */}
      <header className="border-b-2 border-border pb-4 text-center print:hidden">
        <h2 className="text-lg font-extrabold sm:text-xl">{exam.title}</h2>
        <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
          {exam.subject} · {exam.stageLabel}
        </p>
        <p className="mt-1 text-xs font-bold sm:text-sm">
          الزمن: {exam.durationMinutes} دقيقة · الدرجة الكلية: {exam.totalMarks}{" "}
          درجة · عدد الأسئلة: {exam.questionCount}
        </p>
      </header>

      {/* Print-only header — the stage, and nothing more. */}
      <header className="hidden text-center print:block">
        <p className="text-base font-extrabold text-black">{exam.stageLabel}</p>
      </header>

      {/* Instructions show on screen only — the printed sheet is questions-only. */}
      {exam.instructions.length > 0 ? (
        <section className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-xs print:hidden sm:text-sm">
          <h3 className="font-extrabold">تعليمات</h3>
          <ul className="mt-2 list-disc space-y-1 pe-5">
            {exam.instructions.map((instruction, index) => (
              <li key={index}>{instruction}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {exam.sections.map((section, sectionIndex) => (
        <section key={sectionIndex} className="mt-6 print:mt-5">
          <h3 className="border-b border-border pb-2 text-sm font-extrabold print:text-black sm:text-base">
            {section.title}
          </h3>
          <ol className="mt-3 space-y-4">
            {section.questions.map((question, questionIndex) => {
              questionNumber += 1;
              return (
                <li
                  key={questionIndex}
                  className="text-sm leading-relaxed print:text-black"
                >
                  <div className="flex items-start gap-2">
                    <span className="font-extrabold">{questionNumber}.</span>
                    <span className="min-w-0 flex-1">{question.prompt}</span>
                    <span className="shrink-0 text-xs text-muted-foreground print:text-black">
                      ({question.marks} درجة)
                    </span>
                  </div>
                  {question.options.length > 0 ? (
                    <ul className="mt-2 grid gap-1.5 pe-6 text-sm sm:grid-cols-2">
                      {question.options.map((option, optionIndex) => (
                        <li key={optionIndex} className="flex items-start gap-2">
                          <span className="text-muted-foreground print:text-black">
                            {["أ", "ب", "ج", "د", "هـ"][optionIndex] ?? "•"})
                          </span>
                          <span>{option}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 space-y-3 pe-6">
                      <div className="border-b border-dashed border-border" />
                      <div className="border-b border-dashed border-border" />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {/* Teacher name — printed at the bottom-left of the sheet. */}
      {exam.teacherName ? (
        <footer className="mt-10 hidden text-left text-sm font-bold text-black print:block">
          {exam.teacherName}
        </footer>
      ) : null}
    </article>
  );
}
