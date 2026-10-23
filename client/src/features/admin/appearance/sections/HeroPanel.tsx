"use client";

import { useMemo } from "react";
import { cn } from "@/shared/lib/cn";
import {
  RichText,
  heroHeadline,
  MAX_HEADLINE_HIGHLIGHTS,
  type HeadlinePart,
  type HeroStat,
} from "@/shared/site-settings";
import { useAppearance } from "../AppearanceProvider";
import {
  Field,
  IconButton,
  INPUT,
  PreviewFrame,
  SectionCard,
  TextArea,
  TextInput,
} from "../components/form";
import { useDraft } from "../useDraft";
import { validateHero } from "../validation";

/** Headline text for the preview, coloured exactly like the hero (headline.ts). */
function PreviewParts({ parts }: { parts: HeadlinePart[] }) {
  return parts.map((part, i) => (
    <span key={i} className={part.highlight ? "text-primary" : undefined}>
      {part.text}
    </span>
  ));
}

export function HeroPanel() {
  const { resolved, busy, saveSection, resetSection } = useAppearance();
  const { draft, setDraft, dirty } = useDraft(resolved.hero);
  const errors = useMemo(() => validateHero(draft), [draft]);
  const headline = heroHeadline(draft);

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft({ ...draft, [key]: value });
  const setHighlights = (next: string[]) => set("highlights", next);

  const setStat = (index: number, patch: Partial<HeroStat>) =>
    set(
      "stats",
      draft.stats.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );

  return (
    <SectionCard
      title="الصفحة الرئيسية (أول جزء)"
      description="العنوان والوصف والزراير والأرقام اللي بتظهر أول ما الطالب يفتح المنصة."
      dirty={dirty}
      busy={busy}
      errors={errors}
      onSave={() => saveSection("hero", draft)}
      onReset={() => resetSection("hero")}
    >
      <Field label="البادج الصغير فوق العنوان" error={errors.badge}>
        <TextInput value={draft.badge} onChange={(v) => set("badge", v)} maxLength={80} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="العنوان — السطر الأول" error={errors.line1} hint="زي: منصتك الأولى في الأحياء">
          <TextInput value={draft.line1} onChange={(v) => set("line1", v)} maxLength={60} />
        </Field>
        <Field label="العنوان — السطر التاني" error={errors.line2} hint="زي: مع أستاذ كمال أشرف">
          <TextInput value={draft.line2} onChange={(v) => set("line2", v)} maxLength={60} />
        </Field>
      </div>
      <div>
        <div className="mb-1 text-xs font-bold text-foreground">الكلمات الملونة</div>
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          انسخ كلمة أو جملة من السطر الأول أو التاني وحطها هنا، وهتظهر بلون المنصة
          في مكانها (اللي في السطر التاني بيتحط تحتها الخط كمان). تقدر تحط لحد{" "}
          {MAX_HEADLINE_HIGHLIGHTS.toLocaleString("ar-EG")} كلمات — شوف الشكل في
          المعاينة تحت.
        </p>
        {errors.highlights && (
          <p className="mb-2 text-xs font-semibold text-destructive">{errors.highlights}</p>
        )}
        <ol className="space-y-2">
          {draft.highlights.map((word, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                {i + 1}
              </span>
              <Field
                label={`الكلمة الملونة ${i + 1}`}
                error={errors[`highlights.${i}`]}
                className="min-w-0 flex-1 [&>span:first-child]:sr-only"
              >
                <TextInput
                  value={word}
                  onChange={(v) => setHighlights(draft.highlights.map((w, j) => (j === i ? v : w)))}
                  maxLength={40}
                />
              </Field>
              <div className="mt-1.5">
                <IconButton
                  label="مسح الكلمة"
                  danger
                  disabled={draft.highlights.length === 1}
                  onClick={() => setHighlights(draft.highlights.filter((_, j) => j !== i))}
                >
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setHighlights([...draft.highlights, ""])}
          disabled={draft.highlights.length >= MAX_HEADLINE_HIGHLIGHTS}
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
          {draft.highlights.length >= MAX_HEADLINE_HIGHLIGHTS
            ? `وصلت للحد الأقصى (${MAX_HEADLINE_HIGHLIGHTS.toLocaleString("ar-EG")} كلمات)`
            : "إضافة كلمة ملونة"}
        </button>
      </div>

      <Field label="الوصف" error={errors.description} hint="عشان تخلي كلمة تقيلة (Bold) حطها بين نجمتين من كل ناحية: **شرح شامل**">
        <TextArea value={draft.description} onChange={(v) => set("description", v)} maxLength={400} rows={4} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نص الزرار الأساسي" error={errors.primaryCta}>
          <TextInput value={draft.primaryCta} onChange={(v) => set("primaryCta", v)} maxLength={40} />
        </Field>
        <Field label="نص الزرار التاني" error={errors.secondaryCta}>
          <TextInput value={draft.secondaryCta} onChange={(v) => set("secondaryCta", v)} maxLength={40} />
        </Field>
      </div>

      <PreviewFrame>
        <div className="text-[11px] font-bold text-primary">{draft.badge}</div>
        <div className="mt-1.5 text-lg font-extrabold leading-snug text-foreground sm:text-xl">
          <PreviewParts parts={headline.line1} />
          <br />
          <PreviewParts parts={headline.line2} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          <RichText text={draft.description} />
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground">
            {draft.primaryCta}
          </span>
          <span className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground">
            {draft.secondaryCta}
          </span>
        </div>
      </PreviewFrame>

      <div>
        <div className="mb-2 text-xs font-bold text-foreground">الأرقام اللي تحت الصورة</div>
        <div className="grid gap-3 lg:grid-cols-3">
          {draft.stats.map((stat, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border border-border bg-background p-3 transition-opacity",
                !stat.visible && "opacity-60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground">رقم {i + 1}</span>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={stat.visible}
                    onChange={(e) => setStat(i, { visible: e.target.checked })}
                    className="size-4 accent-[var(--primary)]"
                  />
                  ظاهر
                </label>
              </div>
              <div className="mt-2.5 grid grid-cols-[1fr_2fr_1fr] gap-2" dir="ltr">
                <input
                  value={stat.prefix}
                  onChange={(e) => setStat(i, { prefix: e.target.value })}
                  maxLength={3}
                  placeholder="+"
                  aria-label="قبل الرقم"
                  className={cn(INPUT, "px-2 text-center")}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={Number.isFinite(stat.value) ? stat.value : 0}
                  onChange={(e) =>
                    setStat(i, { value: Math.min(100_000_000, Math.max(0, Math.floor(Number(e.target.value) || 0))) })
                  }
                  aria-label="الرقم"
                  className={cn(INPUT, "px-2 text-center font-bold tabular-nums")}
                />
                <input
                  value={stat.suffix}
                  onChange={(e) => setStat(i, { suffix: e.target.value })}
                  maxLength={3}
                  placeholder="%"
                  aria-label="بعد الرقم"
                  className={cn(INPUT, "px-2 text-center")}
                />
              </div>
              <div className="mt-1 grid grid-cols-[1fr_2fr_1fr] gap-2 text-center text-[10px] text-muted-foreground" dir="ltr">
                <span>قبل</span>
                <span>الرقم</span>
                <span>بعد</span>
              </div>
              <Field label="وصف الرقم" error={errors[`stats.${i}.label`]} className="mt-2.5">
                <TextInput value={stat.label} onChange={(v) => setStat(i, { label: v })} maxLength={30} placeholder="مثلاً: طالب وطالبة" />
              </Field>
              <div className="mt-2 text-center text-sm font-extrabold tabular-nums text-primary" dir="ltr">
                {stat.prefix}
                {stat.value.toLocaleString("en-US")}
                {stat.suffix}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
