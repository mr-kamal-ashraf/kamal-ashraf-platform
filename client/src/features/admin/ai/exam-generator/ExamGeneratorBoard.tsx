"use client";

import { useExamGenerator } from "./ExamGeneratorProvider";
import { Panel } from "./components/Panel";
import { SettingsFields } from "./sections/SettingsFields";
import { ContentFields } from "./sections/ContentFields";
import { ExamGeneratorResult } from "./sections/ExamGeneratorResult";
import { SavedExamsList } from "./sections/SavedExamsList";

/**
 * The board: one full-width "توليد الامتحان" panel on top (settings + content
 * fields, laid out side by side in two responsive columns once there's room,
 * stacked on narrow screens), and the two output panels below it
 * (المعاينة / المحفوظة) side by side as before.
 *
 * The top panel is a single <form> so the generate button in its footer
 * submits both field groups at once. It overrides the shared Panel's fixed
 * on-screen height (meant for a single quadrant) with `lg:!h-auto`, since it
 * now holds twice the content and should grow instead of scrolling inside a
 * cramped box.
 */
export function ExamGeneratorBoard() {
  const { generate, canGenerate, isGenerating, form, savedExams } =
    useExamGenerator();
  const kindWord = form.kind === "quiz" ? "الكويز" : "الامتحان";

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* ── الصف العلوي: توليد الامتحان (مربع واحد بعرض الصفحة) ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
        className="print:hidden"
      >
        <Panel
          title="توليد الامتحان"
          className="lg:!h-auto print:hidden"
          footer={
            <>
              <button
                type="submit"
                disabled={!canGenerate || isGenerating}
                className="min-h-[48px] w-full rounded-xl bg-gradient-brand px-6 text-sm font-extrabold text-white shadow-sm transition-opacity disabled:opacity-50 sm:w-auto sm:px-10"
              >
                {isGenerating ? `جاري توليد ${kindWord}...` : `ولّد ${kindWord}`}
              </button>
              {!canGenerate && !isGenerating ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  اكتب الدروس المطلوبة واختار نوع سؤال واحد على الأقل.
                </p>
              ) : null}
            </>
          }
        >
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <SettingsFields />
            <ContentFields />
          </div>
        </Panel>
      </form>

      {/* ── الصف السفلي: المخرجات ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5 print:block">
        <Panel
          title="المعاينة"
          className="print:block print:!h-auto print:!overflow-visible print:rounded-none print:border-0 print:shadow-none"
          headerClassName="print:hidden"
          bodyClassName="print:!overflow-visible print:!p-0"
        >
          <ExamGeneratorResult />
        </Panel>

        <Panel
          title="الامتحانات المحفوظة"
          count={savedExams.length || undefined}
          className="print:hidden"
        >
          <SavedExamsList />
        </Panel>
      </div>
    </div>
  );
}
