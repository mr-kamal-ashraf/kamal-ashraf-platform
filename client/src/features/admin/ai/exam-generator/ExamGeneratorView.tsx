"use client";

import { ExamGeneratorProvider } from "./ExamGeneratorProvider";
import { ExamGeneratorBoard } from "./ExamGeneratorBoard";

export function ExamGeneratorView() {
  return (
    <ExamGeneratorProvider>
      <div className="space-y-6">
        <header className="print:hidden">
          <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
            مولّد الامتحانات
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            املا بيانات الامتحان من المربع اللي تحت، وهتلاقي المعاينة والمكتبة
            تحته. كل امتحان بيتحفظ تلقائي علشان ترجعله في أي وقت.
          </p>
        </header>

        <ExamGeneratorBoard />
      </div>
    </ExamGeneratorProvider>
  );
}
