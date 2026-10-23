"use client";

import { PALETTES, PALETTE_META, type Palette } from "@/config/theme";
import { cn } from "@/shared/lib/cn";
import type { ThemeMode } from "@/shared/site-settings";
import { useAppearance } from "../AppearanceProvider";
import { SectionCard, Toggle } from "../components/form";
import { useDraft } from "../useDraft";

const MODES: Array<{ value: ThemeMode; label: string; hint: string }> = [
  { value: "light", label: "فاتح", hint: "الزوار يشوفوا المنصة فاتحة" },
  { value: "dark", label: "غامق", hint: "الزوار يشوفوا المنصة غامقة" },
  { value: "system", label: "حسب جهاز الطالب", hint: "بيمشي مع إعدادات موبايل/لابتوب الطالب" },
];

/** A tiny mock page painted with one palette (light or dark). */
function Swatch({ colors, label }: { colors: (typeof PALETTE_META)[Palette]["light"]; label: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-black/5" style={{ background: colors.bg }}>
      <div className="space-y-1.5 p-2.5">
        <div className="h-1.5 w-10 rounded-full" style={{ background: colors.text, opacity: 0.8 }} />
        <div className="h-1.5 w-16 rounded-full" style={{ background: colors.text, opacity: 0.35 }} />
        <div className="flex items-center gap-1.5 pt-1">
          <span className="h-4 w-10 rounded-md" style={{ background: colors.primary }} />
          <span className="h-4 w-6 rounded-md" style={{ background: colors.card, border: `1px solid ${colors.primary}` }} />
          <span className="ms-auto size-2.5 rounded-full" style={{ background: colors.highlight }} />
        </div>
      </div>
      <div className="px-2.5 pb-1.5 text-[9px] font-bold" style={{ color: colors.text, opacity: 0.6 }}>
        {label}
      </div>
    </div>
  );
}

export function ThemePanel() {
  const { resolved, busy, saveSection, resetSection } = useAppearance();
  const { draft, setDraft, dirty } = useDraft(resolved.theme);

  return (
    <SectionCard
      title="الألوان والوضع"
      description="اختار ألوان المنصة كلها (الموقع ولوحة التحكم)، والوضع اللي الزوار بيشوفوه أول ما يدخلوا."
      dirty={dirty}
      busy={busy}
      onSave={() => saveSection("theme", draft)}
      onReset={() => resetSection("theme")}
    >
      <div>
        <div className="mb-2 text-xs font-bold text-foreground">باليت الألوان</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {PALETTES.map((p) => {
            const meta = PALETTE_META[p];
            const selected = draft.palette === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setDraft({ ...draft, palette: p })}
                aria-pressed={selected}
                className={cn(
                  "relative rounded-2xl border-2 p-3 text-start transition-all",
                  selected
                    ? "border-primary bg-primary/5 shadow-soft"
                    : "border-border hover:border-primary/40",
                )}
              >
                {selected && (
                  <span className="absolute end-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="size-4 rounded-full" style={{ background: meta.light.primary }} />
                  <span className="text-sm font-extrabold text-foreground">{meta.label}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{meta.description}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Swatch colors={meta.light} label="فاتح" />
                  <Swatch colors={meta.dark} label="غامق" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold text-foreground">الوضع الافتراضي للزوار</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setDraft({ ...draft, defaultMode: m.value })}
              aria-pressed={draft.defaultMode === m.value}
              className={cn(
                "rounded-xl border-2 px-4 py-3 text-start transition-colors",
                draft.defaultMode === m.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div className="text-sm font-bold text-foreground">{m.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{m.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <Toggle
        checked={draft.allowModeToggle}
        onChange={(v) => setDraft({ ...draft, allowModeToggle: v })}
        label="زرار تغيير الوضع (فاتح / غامق) للطلبة"
        description={
          draft.allowModeToggle
            ? "الطالب يقدر يبدّل بنفسه، واختياره بيتحفظ على جهازه."
            : "الزرار هيختفي، وكل الزوار هيشوفوا الوضع الافتراضي اللي فوق."
        }
      />
    </SectionCard>
  );
}
