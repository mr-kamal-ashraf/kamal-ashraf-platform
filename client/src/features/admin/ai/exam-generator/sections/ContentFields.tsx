"use client";

import { useExamGenerator } from "../ExamGeneratorProvider";
import { QUESTION_TYPE_OPTIONS } from "../config";

const FIELD_CLASSES =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

const SUB_LABEL = "text-xs font-semibold text-muted-foreground";

/** Top-right panel: what the paper should contain. */
export function ContentFields() {
  const { form, setField, toggleQuestionType } = useExamGenerator();

  return (
    <div className="space-y-5">
      <label className="flex flex-col gap-1.5">
        <span className={SUB_LABEL}>الدروس اللي عايز الامتحان منها</span>
        <textarea
          value={form.topics}
          onChange={(e) => setField("topics", e.target.value)}
          rows={3}
          placeholder={
            "اكتب أسماء الدروس أو الفصول اللي عايز الأسئلة تتعمل منها.\nمثال:\nالباب الأول: الخلية - التركيب والوظيفة\nدرس الوراثة: تجارب مندل"
          }
          className={`${FIELD_CLASSES} nice-scroll resize-y`}
        />
        <span className="text-[11px] leading-relaxed text-muted-foreground">
          ده اللي بيحدد محتوى الامتحان — اكتب أسماء الدروس أو الفصول من المنهج.
          كل ما تكون محدد أكتر، كل ما الأسئلة تطلع أدق.
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <span className={SUB_LABEL}>أنواع الأسئلة</span>
        <div className="flex flex-wrap gap-2">
          {QUESTION_TYPE_OPTIONS.map((option) => {
            const selected = form.questionTypes.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleQuestionType(option.value)}
                aria-pressed={selected}
                className={`min-h-[42px] rounded-xl border px-4 text-xs font-bold transition-all ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={SUB_LABEL}>أسئلة من عندك (اختياري)</span>
        <textarea
          value={form.customQuestions ?? ""}
          onChange={(e) => setField("customQuestions", e.target.value)}
          rows={3}
          placeholder={
            "سؤال في كل سطر — بتتضاف للامتحان زي ما هي.\nمثال:\nقارن بين الانقسام الميتوزي والميوزي.\nاذكر الخواص الفيزيائية للمعادن."
          }
          className={`${FIELD_CLASSES} nice-scroll resize-y`}
        />
        <span className="text-[11px] leading-relaxed text-muted-foreground">
          أسئلتك انت — بتضاف للورقة زي ما كتبتها بالظبط، حتى لو مش في المنهج.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={SUB_LABEL}>ملاحظات إضافية (اختياري)</span>
        <input
          type="text"
          value={form.notes ?? ""}
          onChange={(e) => setField("notes", e.target.value)}
          placeholder="مثال: ركّز على الرسومات التوضيحية وأسئلة الفهم"
          className={FIELD_CLASSES}
        />
      </label>
    </div>
  );
}
