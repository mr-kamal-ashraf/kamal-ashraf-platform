"use client";

import { useExamGenerator } from "../ExamGeneratorProvider";
import { DIFFICULTY_OPTIONS, KIND_OPTIONS, STAGE_OPTIONS } from "../config";
import type { ExamDifficulty } from "@/api";
import type { Stage } from "@/api/types";

const FIELD_CLASSES =
  "min-h-[44px] w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

const SUB_LABEL = "text-xs font-semibold text-muted-foreground";
const GROUP_TITLE = "text-[11px] font-bold text-muted-foreground";

/** Top-left panel: what kind of paper, for whom, and from which books. */
export function SettingsFields() {
  const { form, books, booksLoading, setField, toggleBook } =
    useExamGenerator();

  const stageBooks = books.filter((book) => book.stage === form.stage);

  return (
    <div className="space-y-6">
      {/* النوع */}
      <div className="grid grid-cols-2 gap-2.5">
        {KIND_OPTIONS.map((option) => {
          const selected = form.kind === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setField("kind", option.value)}
              aria-pressed={selected}
              className={`min-h-[46px] rounded-xl border text-sm font-bold transition-all ${
                selected
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* البيانات */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={SUB_LABEL}>المرحلة</span>
          <select
            value={form.stage}
            onChange={(e) => {
              setField("stage", e.target.value as Stage);
              setField("bookIds", []);
            }}
            className={FIELD_CLASSES}
          >
            {STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={SUB_LABEL}>الصعوبة</span>
          <select
            value={form.difficulty}
            onChange={(e) =>
              setField("difficulty", e.target.value as ExamDifficulty)
            }
            className={FIELD_CLASSES}
          >
            {DIFFICULTY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={SUB_LABEL}>عدد الأسئلة</span>
          <input
            type="number"
            min={1}
            max={50}
            value={form.questionCount}
            onChange={(e) => setField("questionCount", Number(e.target.value))}
            className={FIELD_CLASSES}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={SUB_LABEL}>الزمن (دقيقة)</span>
          <input
            type="number"
            min={5}
            max={300}
            value={form.durationMinutes}
            onChange={(e) =>
              setField("durationMinutes", Number(e.target.value))
            }
            className={FIELD_CLASSES}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={SUB_LABEL}>الدرجة الكلية</span>
          <input
            type="number"
            min={1}
            max={300}
            value={form.totalMarks}
            onChange={(e) => setField("totalMarks", Number(e.target.value))}
            className={FIELD_CLASSES}
          />
        </label>
      </div>

      {/* المصدر */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className={GROUP_TITLE}>المصدر (المنهج)</span>
          {form.bookIds.length > 0 ? (
            <span className="text-[11px] font-bold text-primary">
              {form.bookIds.length} مختار
            </span>
          ) : null}
        </div>

        {booksLoading ? (
          <p className="text-xs text-muted-foreground">جاري تحميل الكتب…</p>
        ) : stageBooks.length === 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-3 text-[11px] leading-relaxed text-amber-600">
            مفيش منهج مرفوع للمرحلة دي. ارفع الكتاب الأول من قسم «منهج المساعد
            الذكي».
          </div>
        ) : (
          <div className="space-y-2">
            {stageBooks.map((book) => {
              const checked = form.bookIds.includes(book.book_id);
              return (
                <button
                  key={book.book_id}
                  type="button"
                  onClick={() => toggleBook(book.book_id)}
                  aria-pressed={checked}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-right text-sm transition-all ${
                    checked
                      ? "border-primary bg-primary/5 ring-1 ring-primary/25"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      checked
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-background"
                    }`}
                  >
                    {checked ? (
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="size-3.5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.9a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                    {book.subject
                      ? `${book.subject} — ${book.book_id}`
                      : book.book_id}
                  </span>
                </button>
              );
            })}
            <p className="text-[11px] text-muted-foreground">
              {form.bookIds.length === 0
                ? "من غير اختيار = كل كتب المرحلة. تقدر تختار أكتر من كتاب."
                : "الأسئلة هتتولّد من الكتب المختارة بس."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
