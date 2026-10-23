"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  DEFAULT_FONT,
  FONT_GROUPS,
  FONT_META,
  FONTS,
  fontFamily,
  fontStyleVars,
  fontStylesheet,
  type FontGroup,
  type FontKey,
} from "@/config/fonts";
import { cn } from "@/shared/lib/cn";
import { BtnNucleus } from "@/shared/ui/Button";
import { useAppearance } from "../AppearanceProvider";
import { INPUT, SectionCard } from "../components/form";

const DEFAULT_SAMPLE =
  "دروس شرح شامل ومراجعات نهائية — من الخلية والوراثة لحد المعادن وطبقات الأرض.";
const GROUP_ORDER: FontGroup[] = ["clean", "playful", "elegant"];

/**
 * The website only ships the active font's @font-face rules, so the picker
 * loads every font's (tiny) stylesheet itself. Font files still download only
 * once a specimen is on screen. Links are added once and kept for the visit.
 */
function useAllFontStylesheets() {
  useEffect(() => {
    for (const key of FONTS) {
      const href = fontStylesheet(key);
      if (document.querySelector(`link[data-platform-font="${key}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.platformFont = key;
      document.head.appendChild(link);
    }
  }, []);
}

function FontCard({
  fontKey,
  sample,
  active,
  saving,
  disabled,
  onPick,
}: {
  fontKey: FontKey;
  sample: string;
  active: boolean;
  saving: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const meta = FONT_META[fontKey];
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled && !active}
      aria-pressed={active}
      aria-label={
        active
          ? `${meta.label} — الخط الحالي للمنصة`
          : `استخدم خط ${meta.label} للمنصة`
      }
      className={cn(
        "group relative flex min-w-0 flex-col gap-3 rounded-2xl border-2 bg-background p-4 text-start transition-all",
        active
          ? "border-primary shadow-soft"
          : "border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft",
        disabled && !active && "cursor-wait opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-extrabold text-foreground">
            {meta.label}
          </span>
          <span
            className="text-[11px] font-semibold text-muted-foreground"
            dir="ltr"
          >
            {meta.family}
          </span>
        </div>
        {active ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            <svg
              className="size-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            الخط الحالي
          </span>
        ) : fontKey === DEFAULT_FONT ? (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
            الأصلي
          </span>
        ) : null}
      </div>

      {/* The specimen, set in the font itself at the size the site will use. */}
      <div
        className="space-y-2"
        style={
          {
            ...fontStyleVars(fontKey),
            fontFamily: `${fontFamily(fontKey)}, system-ui, sans-serif`,
          } as CSSProperties
        }
      >
        <div className="text-xl font-extrabold leading-snug text-foreground">
          منصتك الأولى في <span className="text-primary">الأحياء</span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground wrap-anywhere">
          {sample}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-bold text-foreground">
          <span>
            <span className="text-primary">+٥٬٠٠٠</span> طالب
          </span>
          <span>
            <span className="text-primary">15</span> سنة خبرة
          </span>
          <span>تالتة ثانوي</span>
        </div>
        <div className="pt-1">
          <span className="btn btn-primary btn-sm pointer-events-none">
            <BtnNucleus />
            ابدأ رحلتك دلوقتي
          </span>
        </div>
      </div>

      <div
        className={cn(
          "mt-auto border-t border-border/70 pt-2.5 text-center text-xs font-bold transition-colors",
          active
            ? "text-primary"
            : "text-muted-foreground group-hover:text-primary",
        )}
      >
        {saving
          ? "جارٍ التطبيق على المنصة..."
          : active
            ? "ده خط المنصة دلوقتي"
            : "استخدم الخط ده"}
      </div>
    </button>
  );
}

/** Admin "الخطوط": the teacher picks the platform font — it applies on click. */
export function FontsPanel() {
  const { resolved, busy, saveSection } = useAppearance();
  const current = resolved.typography.font;
  const [pending, setPending] = useState<FontKey | null>(null);
  const [sample, setSample] = useState("");
  useAllFontStylesheets();

  const pick = async (key: FontKey) => {
    if (key === current || busy) return;
    setPending(key);
    await saveSection("typography", { font: key });
    setPending(null);
  };

  return (
    <SectionCard
      title="خط المنصة"
      description="دوس على الخط اللي يعجبك، وهيبقى هو خط المنصة كلها في خلال ثواني. تقدر ترجع لأي خط تاني في أي وقت، ولوحة التحكم بتفضل بخطها."
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-background px-4 py-3">
        <span className="text-xs font-bold text-muted-foreground">
          الخط الحالي:
        </span>
        <span
          className="text-sm font-extrabold text-foreground"
          style={{
            fontFamily: `${fontFamily(current)}, system-ui, sans-serif`,
          }}
        >
          {FONT_META[current].label}
        </span>
        <span className="text-[11px] text-muted-foreground" dir="ltr">
          {FONT_META[current].family}
        </span>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-foreground">
          جرّب جملتك على كل الخطوط
        </span>
        <input
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          maxLength={160}
          placeholder="اكتب أي جملة…"
          className={INPUT}
        />
      </label>

      {GROUP_ORDER.map((group) => {
        const keys = FONTS.filter((k) => FONT_META[k].group === group);
        return (
          <section key={group} className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-sm font-extrabold text-foreground">
                {FONT_GROUPS[group].label}
              </h3>
              <span className="text-xs text-muted-foreground">
                {keys.length} خطوط · {FONT_GROUPS[group].hint}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {keys.map((key) => (
                <FontCard
                  key={key}
                  fontKey={key}
                  sample={sample.trim() || DEFAULT_SAMPLE}
                  active={key === current}
                  saving={pending === key}
                  disabled={busy}
                  onPick={() => pick(key)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </SectionCard>
  );
}
