"use client";

import { useMemo } from "react";
import { cn } from "@/shared/lib/cn";
import type { WhyUsItem } from "@/shared/site-settings";
import { useAppearance } from "../AppearanceProvider";
import { Field, INPUT, SectionCard, TextArea, TextInput } from "../components/form";
import { useDraft } from "../useDraft";
import { validateWhyUs } from "../validation";

export function WhyUsPanel() {
  const { resolved, busy, saveSection, resetSection } = useAppearance();
  const { draft, setDraft, dirty } = useDraft(resolved.whyUs);
  const errors = useMemo(() => validateWhyUs(draft), [draft]);

  const setItem = (index: number, patch: Partial<WhyUsItem>) =>
    setDraft({
      ...draft,
      items: draft.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    });

  return (
    <SectionCard
      title="ليه تذاكر معانا؟"
      description="المميزات الأربعة اللي بتظهر في قسم «ليه تختارنا» وجملة الهدف اللي تحتهم."
      dirty={dirty}
      busy={busy}
      errors={errors}
      onSave={() => saveSection("whyUs", draft)}
      onReset={() => resetSection("whyUs")}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {draft.items.map((item, i) => (
          <div key={i} className="rounded-xl border border-border bg-background p-3.5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                {i + 1}
              </span>
              <span className="text-xs font-bold text-muted-foreground">الميزة {i + 1}</span>
            </div>
            <div className="grid grid-cols-[4.5rem_1fr] gap-2">
              <Field label="إيموجي">
                <input
                  value={item.emoji}
                  onChange={(e) => setItem(i, { emoji: e.target.value })}
                  maxLength={8}
                  aria-label="إيموجي"
                  className={cn(INPUT, "text-center text-lg")}
                />
              </Field>
              <Field label="العنوان" error={errors[`items.${i}.title`]}>
                <TextInput value={item.title} onChange={(v) => setItem(i, { title: v })} maxLength={60} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="الوصف" error={errors[`items.${i}.description`]}>
                <TextArea value={item.description} onChange={(v) => setItem(i, { description: v })} maxLength={400} rows={4} />
              </Field>
            </div>
          </div>
        ))}
      </div>

      <Field label="جملة الهدف" error={errors.goal} hint="الجملة اللي بتختم القسم.">
        <TextArea value={draft.goal} onChange={(v) => setDraft({ ...draft, goal: v })} maxLength={240} rows={2} />
      </Field>
    </SectionCard>
  );
}
