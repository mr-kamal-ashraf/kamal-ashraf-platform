"use client";

import { useMemo } from "react";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import { CourseWelcomeCard } from "@/features/courses/components/CourseWelcomeCard";
import {
  WELCOME_COURSE_TOKEN,
  WELCOME_NAME_TOKEN,
} from "@/shared/site-settings";
import { BtnNucleus } from "@/shared/ui/Button";
import { useAppearance } from "../AppearanceProvider";
import {
  Field,
  IconButton,
  PreviewFrame,
  SectionCard,
  TextArea,
  TextInput,
} from "../components/form";
import { useDraft } from "../useDraft";
import { validateWelcome } from "../validation";

const MAX_LINES = 8;

/** Adds a token ({الاسم} / {الكورس}) to the end of a text. */
function TokenButton({
  label,
  token,
  value,
  max,
  onChange,
}: {
  label: string;
  token: string;
  value: string;
  max: number;
  onChange: (v: string) => void;
}) {
  const next = value.endsWith(" ") || !value ? value + token : `${value} ${token}`;
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      disabled={next.length > max}
      className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
    >
      + {label}
    </button>
  );
}

/**
 * بوب أب التهنئة: what a student reads when a course opens for them (after
 * paying, a code, or a free course) — the title, the message and the
 * motivating lines, with the student's name and the course filled in.
 */
export function WelcomePanel() {
  const { resolved, busy, saveSection, resetSection } = useAppearance();
  const { draft, setDraft, dirty } = useDraft(resolved.welcome);
  const errors = useMemo(() => validateWelcome(draft), [draft]);
  const confirm = useConfirm();
  const lines = draft.lines;

  const setLines = (next: string[]) => setDraft({ ...draft, lines: next });
  const move = (from: number, to: number) => {
    const next = [...lines];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setLines(next);
  };

  return (
    <SectionCard
      title="بوب أب التهنئة"
      description="الرسالة اللي بتظهر للطالب أول ما الكورس يتفتحله — بعد ما يدفع، أو يفعّل كود، أو يفتح كورس مجاني."
      dirty={dirty}
      busy={busy}
      errors={errors}
      onSave={() =>
        saveSection("welcome", {
          title: draft.title.trim(),
          message: draft.message.trim(),
          lines: lines.map((l) => l.trim()),
        })
      }
      onReset={() => resetSection("welcome")}
    >
      <Field
        label="العنوان"
        error={errors.title}
        hint={`${WELCOME_NAME_TOKEN} بيتبدل باسم الطالب.`}
      >
        <TextInput
          value={draft.title}
          onChange={(v) => setDraft({ ...draft, title: v })}
          maxLength={60}
        />
      </Field>
      <div className="-mt-2 flex flex-wrap gap-1.5">
        <TokenButton
          label="اسم الطالب"
          token={WELCOME_NAME_TOKEN}
          value={draft.title}
          max={60}
          onChange={(v) => setDraft({ ...draft, title: v })}
        />
      </div>

      <Field
        label="الرسالة"
        error={errors.message}
        hint={`${WELCOME_COURSE_TOKEN} بيتبدل باسم الكورس (ويظهر بخط عريض).`}
      >
        <TextArea
          value={draft.message}
          onChange={(v) => setDraft({ ...draft, message: v })}
          maxLength={160}
          rows={2}
        />
      </Field>
      <div className="-mt-2 flex flex-wrap gap-1.5">
        <TokenButton
          label="اسم الكورس"
          token={WELCOME_COURSE_TOKEN}
          value={draft.message}
          max={160}
          onChange={(v) => setDraft({ ...draft, message: v })}
        />
        <TokenButton
          label="اسم الطالب"
          token={WELCOME_NAME_TOKEN}
          value={draft.message}
          max={160}
          onChange={(v) => setDraft({ ...draft, message: v })}
        />
      </div>

      <div>
        <div className="mb-1.5 text-xs font-bold text-foreground">
          الجمل التحفيزية
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          كل مرة بتظهر جملة واحدة منهم بشكل عشوائي. لو مسحتهم كلهم، المربع ده
          مش هيظهر.
        </p>
        <ol className="space-y-2">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                {i + 1}
              </span>
              <Field
                label={`جملة ${i + 1}`}
                error={errors[`lines.${i}`]}
                className="min-w-0 flex-1 [&>span:first-child]:sr-only"
              >
                <TextInput
                  value={line}
                  onChange={(v) =>
                    setLines(lines.map((l, j) => (j === i ? v : l)))
                  }
                  maxLength={200}
                />
              </Field>
              <div className="mt-1.5 flex items-center gap-1">
                <IconButton
                  label="لفوق"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                >
                  <path d="m18 15-6-6-6 6" />
                </IconButton>
                <IconButton
                  label="لتحت"
                  onClick={() => move(i, i + 1)}
                  disabled={i === lines.length - 1}
                >
                  <path d="m6 9 6 6 6-6" />
                </IconButton>
                <IconButton
                  label="مسح الجملة"
                  danger
                  onClick={async () => {
                    const ok =
                      !line.trim() ||
                      (await confirm({
                        title: "مسح الجملة",
                        message: `«${line}» هتتمسح من القائمة. متأكد؟`,
                        confirmLabel: "امسح",
                        tone: "danger",
                      }));
                    if (ok) setLines(lines.filter((_, j) => j !== i));
                  }}
                >
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setLines([...lines, ""])}
          disabled={lines.length >= MAX_LINES}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 text-sm font-bold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {lines.length >= MAX_LINES
            ? `وصلت للحد الأقصى (${MAX_LINES} جمل)`
            : "إضافة جملة"}
        </button>
      </div>

      <PreviewFrame>
        <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-7 text-center shadow-elegant">
          <CourseWelcomeCard
            title={draft.title}
            message={draft.message}
            line={lines.find((l) => l.trim()) ?? null}
            firstName="أحمد"
            courseTitle="اسم الكورس"
          >
            <span className="btn btn-primary pointer-events-none flex-1">
              <BtnNucleus />
              ابدأ أول درس
            </span>
            <span className="btn btn-secondary pointer-events-none">بعدين</span>
          </CourseWelcomeCard>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          في المعاينة: «أحمد» مكان اسم الطالب، و«اسم الكورس» مكان الكورس، وأول
          جملة تحفيزية.
        </p>
      </PreviewFrame>
    </SectionCard>
  );
}
