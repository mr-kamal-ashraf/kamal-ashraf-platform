"use client";

import { useMemo } from "react";
import { whatsappLinkFor, type ContactSettings } from "@/shared/site-settings";
import { useAppearance } from "../AppearanceProvider";
import { Field, SectionCard, TextInput } from "../components/form";
import { useDraft } from "../useDraft";
import { validateContact } from "../validation";

const SOCIALS: Array<{ key: keyof ContactSettings; label: string; placeholder: string }> = [
  { key: "facebook", label: "فيسبوك", placeholder: "https://facebook.com/..." },
  { key: "instagram", label: "إنستجرام", placeholder: "https://instagram.com/..." },
  { key: "youtube", label: "يوتيوب", placeholder: "https://youtube.com/@..." },
  { key: "tiktok", label: "تيك توك", placeholder: "https://tiktok.com/@..." },
  { key: "telegram", label: "تيليجرام", placeholder: "https://t.me/..." },
];

/** `resolved.contact` also carries computed links — keep only what the teacher edits. */
function editableFields(c: ContactSettings): ContactSettings {
  return {
    phone: c.phone,
    whatsapp: c.whatsapp,
    email: c.email,
    facebook: c.facebook,
    instagram: c.instagram,
    youtube: c.youtube,
    tiktok: c.tiktok,
    telegram: c.telegram,
  };
}

export function ContactPanel() {
  const { resolved, busy, saveSection, resetSection } = useAppearance();
  const { draft, setDraft, dirty } = useDraft(editableFields(resolved.contact));
  const set = (key: keyof ContactSettings, value: string) => setDraft({ ...draft, [key]: value });
  const errors = useMemo(() => validateContact(draft), [draft]);
  const waLink = whatsappLinkFor(draft.whatsapp);

  return (
    <SectionCard
      title="التواصل والسوشيال ميديا"
      description="الأرقام واللينكات اللي بتظهر في الفوتر وزراير الواتساب. أي خانة تسيبها فاضية مش هتظهر على المنصة."
      dirty={dirty}
      busy={busy}
      errors={errors}
      onSave={() => saveSection("contact", draft)}
      onReset={() => resetSection("contact")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="رقم الموبايل (للاتصال)" error={errors.phone}>
          <TextInput value={draft.phone} onChange={(v) => set("phone", v)} maxLength={30} dir="ltr" placeholder="01xxxxxxxxx" />
        </Field>
        <Field
          label="رقم الواتساب"
          error={errors.whatsapp}
          hint={waLink ? `زراير الواتساب هتفتح: ${waLink}` : "لو فاضي، زراير الواتساب مش هتظهر."}
        >
          <TextInput value={draft.whatsapp} onChange={(v) => set("whatsapp", v)} maxLength={30} dir="ltr" placeholder="01xxxxxxxxx" />
        </Field>
        <Field label="الإيميل" error={errors.email} className="sm:col-span-2">
          <TextInput value={draft.email} onChange={(v) => set("email", v)} maxLength={120} dir="ltr" placeholder="name@example.com" />
        </Field>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold text-foreground">السوشيال ميديا</div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIALS.map((s) => (
            <Field key={s.key} label={s.label} error={errors[s.key]}>
              <TextInput value={draft[s.key]} onChange={(v) => set(s.key, v)} maxLength={300} dir="ltr" placeholder={s.placeholder} />
            </Field>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
