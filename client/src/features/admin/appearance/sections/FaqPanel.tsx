"use client";

import { useMemo } from "react";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import type { FaqItem } from "@/shared/site-settings";
import { useAppearance } from "../AppearanceProvider";
import { Field, IconButton, SectionCard, TextArea, TextInput } from "../components/form";
import { useDraft } from "../useDraft";
import { validateFaq } from "../validation";

const MAX_ITEMS = 20;

export function FaqPanel() {
  const { resolved, busy, saveSection, resetSection } = useAppearance();
  const { draft, setDraft, dirty } = useDraft(resolved.faq);
  const errors = useMemo(() => validateFaq(draft), [draft]);
  const confirm = useConfirm();
  const items = draft.items;

  const setItems = (next: FaqItem[]) => setDraft({ items: next });
  const setItem = (index: number, patch: Partial<FaqItem>) =>
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  const move = (from: number, to: number) => {
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setItems(next);
  };

  return (
    <SectionCard
      title="الأسئلة الشائعة"
      description={`الأسئلة اللي بتظهر في قسم «كل اللي محتاج تعرفه قبل ما تبدأ». لحد ${MAX_ITEMS} سؤال، ولو مسحتهم كلهم القسم هيختفي.`}
      dirty={dirty}
      busy={busy}
      errors={errors}
      onSave={() => saveSection("faq", draft)}
      onReset={() => resetSection("faq")}
    >
      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          مفيش أسئلة — القسم مش هيظهر على المنصة.
        </div>
      )}

      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="rounded-xl border border-border bg-background p-3.5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                {i + 1}
              </span>
              <span className="text-xs font-bold text-muted-foreground">سؤال {i + 1}</span>
              <div className="ms-auto flex items-center gap-1.5">
                <IconButton label="لفوق" onClick={() => move(i, i - 1)} disabled={i === 0}>
                  <path d="m18 15-6-6-6 6" />
                </IconButton>
                <IconButton label="لتحت" onClick={() => move(i, i + 1)} disabled={i === items.length - 1}>
                  <path d="m6 9 6 6 6-6" />
                </IconButton>
                <IconButton
                  label="مسح السؤال"
                  danger
                  onClick={async () => {
                    const ok =
                      !item.q.trim() && !item.a.trim()
                        ? true
                        : await confirm({
                            title: "مسح السؤال",
                            message: `«${item.q || "سؤال فاضي"}» هيتمسح من القائمة. متأكد؟`,
                            confirmLabel: "امسح",
                            tone: "danger",
                          });
                    if (ok) setItems(items.filter((_, j) => j !== i));
                  }}
                >
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </IconButton>
              </div>
            </div>
            <div className="space-y-3">
              <Field label="السؤال" error={errors[`items.${i}.q`]}>
                <TextInput value={item.q} onChange={(v) => setItem(i, { q: v })} maxLength={200} />
              </Field>
              <Field label="الإجابة" error={errors[`items.${i}.a`]}>
                <TextArea value={item.a} onChange={(v) => setItem(i, { a: v })} maxLength={1500} rows={3} />
              </Field>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => setItems([...items, { q: "", a: "" }])}
        disabled={items.length >= MAX_ITEMS}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 text-sm font-bold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {items.length >= MAX_ITEMS ? `وصلت للحد الأقصى (${MAX_ITEMS} سؤال)` : "إضافة سؤال"}
      </button>
    </SectionCard>
  );
}
