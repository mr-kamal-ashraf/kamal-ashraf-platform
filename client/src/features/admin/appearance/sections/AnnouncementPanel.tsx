"use client";

import { useMemo } from "react";
import { cn } from "@/shared/lib/cn";
import { isAnnouncementLive, type AnnouncementSettings } from "@/shared/site-settings";
import { useAppearance } from "../AppearanceProvider";
import { Field, INPUT, PreviewFrame, SectionCard, TextInput, Toggle } from "../components/form";
import { useDraft } from "../useDraft";
import { validateAnnouncement } from "../validation";

/** ISO string → value for <input type="datetime-local"> (in the admin's local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO string (or null when cleared). */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

function status(a: AnnouncementSettings): { label: string; tone: "live" | "wait" | "off" } {
  if (!a.enabled) return { label: "مقفول", tone: "off" };
  if (!a.text.trim()) return { label: "محتاج نص", tone: "off" };
  const now = new Date();
  if (a.startsAt && new Date(a.startsAt) > now) return { label: `هيبدأ ${formatDate(a.startsAt)}`, tone: "wait" };
  if (a.endsAt && new Date(a.endsAt) <= now) return { label: "انتهى", tone: "off" };
  return isAnnouncementLive(a, now) ? { label: "ظاهر دلوقتي للطلبة", tone: "live" } : { label: "مقفول", tone: "off" };
}

function DateField({
  label,
  value,
  onChange,
  hint,
  error,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  hint: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex gap-2">
        <input
          type="datetime-local"
          value={toLocalInput(value)}
          onChange={(e) => onChange(fromLocalInput(e.target.value))}
          className={cn(INPUT, "flex-1")}
          dir="ltr"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-11 shrink-0 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            مسح
          </button>
        )}
      </div>
    </Field>
  );
}

export function AnnouncementPanel() {
  const { resolved, busy, saveSection, resetSection } = useAppearance();
  const { draft, setDraft, dirty } = useDraft(resolved.announcement);
  const set = <K extends keyof AnnouncementSettings>(key: K, value: AnnouncementSettings[K]) =>
    setDraft({ ...draft, [key]: value });
  const current = status(resolved.announcement);
  const errors = useMemo(() => validateAnnouncement(draft), [draft]);

  return (
    <SectionCard
      title="شريط الإعلانات"
      description="شريط صغير فوق المنصة للعروض والأخبار (زي خصم أو امتحان جديد). الطالب يقدر يقفله، وبيرجع يظهر له لو غيّرت الإعلان."
      dirty={dirty}
      busy={busy}
      errors={errors}
      onSave={() => saveSection("announcement", draft)}
      onReset={() => resetSection("announcement")}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-muted-foreground">حالة الإعلان المحفوظ:</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold",
            current.tone === "live" && "bg-emerald-500/10 text-emerald-600",
            current.tone === "wait" && "bg-amber-500/10 text-amber-600",
            current.tone === "off" && "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              current.tone === "live" ? "bg-emerald-500" : current.tone === "wait" ? "bg-amber-500" : "bg-muted-foreground/50",
            )}
          />
          {current.label}
        </span>
      </div>

      <Toggle
        checked={draft.enabled}
        onChange={(v) => set("enabled", v)}
        label="تشغيل الإعلان"
        description={draft.enabled ? "الإعلان هيظهر في المواعيد اللي تحت (أو على طول لو مفيش مواعيد)." : "الإعلان مخفي."}
      />

      <Field label="نص الإعلان" error={errors.text}>
        <TextInput
          value={draft.text}
          onChange={(v) => set("text", v)}
          maxLength={160}
          placeholder="مثلاً: خصم ٢٠٪ على كورس المراجعة النهائية لحد آخر الأسبوع 🎉"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نص اللينك (اختياري)" error={errors.linkLabel} hint='لو فاضي هيظهر "اعرف أكتر".'>
          <TextInput value={draft.linkLabel} onChange={(v) => set("linkLabel", v)} maxLength={30} placeholder="احجز دلوقتي" />
        </Field>
        <Field label="اللينك (اختياري)" error={errors.linkUrl} hint="صفحة في المنصة زي /courses أو لينك كامل يبدأ بـ https://">
          <TextInput value={draft.linkUrl} onChange={(v) => set("linkUrl", v)} maxLength={300} dir="ltr" placeholder="/courses" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField
          label="يبدأ من (اختياري)"
          value={draft.startsAt}
          onChange={(v) => set("startsAt", v)}
          hint="لو فاضي، بيظهر من أول ما تحفظ."
        />
        <DateField
          label="ينتهي في (اختياري)"
          error={errors.endsAt}
          value={draft.endsAt}
          onChange={(v) => set("endsAt", v)}
          hint="لو فاضي، بيفضل ظاهر لحد ما تقفله."
        />
      </div>

      <PreviewFrame>
        {draft.text.trim() ? (
          <div className="overflow-hidden rounded-lg bg-primary text-primary-foreground">
            <div className="flex items-center justify-center px-8 py-2.5 text-center text-xs font-bold sm:text-sm">
              <p className="leading-relaxed">
                {draft.text}
                {draft.linkUrl && (
                  <span className="ms-2 underline decoration-2 underline-offset-4">
                    {draft.linkLabel || "اعرف أكتر"} ←
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-3 text-center text-xs text-muted-foreground">اكتب نص الإعلان عشان تشوف شكله.</div>
        )}
      </PreviewFrame>
    </SectionCard>
  );
}
