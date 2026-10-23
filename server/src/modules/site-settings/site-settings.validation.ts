import { z } from "zod";
import {
  ASSET_SLOTS,
  FONTS,
  PALETTES,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "./site-settings.model";

/*
 * One Zod schema per editable section. Texts are rendered by React as plain
 * text (escaped), so the limits here are about sane lengths, not sanitising.
 */

const text = (max: number, label: string) =>
  z
    .string({ required_error: `${label} مطلوب` })
    .trim()
    .min(1, `${label} مطلوب`)
    .max(max, `${label} طويل جداً (أقصى حد ${max} حرف)`);

const optionalText = (max: number) => z.string().trim().max(max).default("");

/** An http(s) URL, or empty to hide the item. */
const optionalUrl = (name: string) =>
  z
    .string()
    .trim()
    .max(300, `لينك ${name} طويل جداً`)
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), `لينك ${name} لازم يبدأ بـ https://`)
    .default("");

/** Phone-ish string: digits, spaces, +, -, (). Empty hides it. */
const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || /^[+\d\s()-]{6,30}$/.test(v), "رقم الموبايل غير صحيح")
  .default("");

export const themeSectionSchema = z.object({
  palette: z.enum(PALETTES),
  defaultMode: z.enum(["light", "dark", "system"]),
  allowModeToggle: z.boolean(),
});

export const typographySectionSchema = z.object({
  font: z.enum(FONTS),
});

export const heroSectionSchema = z.object({
  badge: text(80, "نص البادج"),
  line1: text(60, "السطر الأول"),
  // الكلمات الملونة (older saves had one `highlight`; the client reads both).
  highlights: z
    .array(text(40, "الكلمة الملونة"))
    .min(1, "لازم كلمة ملونة واحدة على الأقل")
    .max(5, "أقصى عدد ٥ كلمات ملونة"),
  line2Prefix: optionalText(20),
  line2: text(60, "السطر الثاني"),
  description: text(400, "الوصف"),
  primaryCta: text(40, "نص الزرار الأساسي"),
  secondaryCta: text(40, "نص الزرار الثانوي"),
  stats: z
    .array(
      z.object({
        value: z.coerce.number().int().min(0).max(100_000_000),
        prefix: z.string().trim().max(3).default(""),
        suffix: z.string().trim().max(3).default(""),
        label: text(30, "وصف الرقم"),
        visible: z.boolean(),
      })
    )
    .length(3, "لازم ٣ أرقام"),
});

export const whyUsSectionSchema = z.object({
  items: z
    .array(
      z.object({
        title: text(60, "عنوان الميزة"),
        emoji: z.string().trim().max(8).default(""),
        description: text(400, "وصف الميزة"),
      })
    )
    .length(4, "لازم ٤ مميزات"),
  goal: text(240, "جملة الهدف"),
});

export const faqSectionSchema = z.object({
  items: z
    .array(
      z.object({
        q: text(200, "السؤال"),
        a: text(1500, "الإجابة"),
      })
    )
    .max(20, "أقصى عدد ٢٠ سؤال"),
});

export const contactSectionSchema = z.object({
  phone: optionalPhone,
  whatsapp: optionalPhone,
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "الإيميل غير صحيح")
    .default(""),
  facebook: optionalUrl("فيسبوك"),
  instagram: optionalUrl("إنستجرام"),
  youtube: optionalUrl("يوتيوب"),
  tiktok: optionalUrl("تيك توك"),
  telegram: optionalUrl("تيليجرام"),
});

export const announcementSectionSchema = z
  .object({
    enabled: z.boolean(),
    text: z.string().trim().max(160, "نص الإعلان طويل جداً").default(""),
    linkLabel: z.string().trim().max(30).default(""),
    linkUrl: z
      .string()
      .trim()
      .max(300)
      .refine(
        // "/page" on the site (not "//host", which would leave the site) or an http(s) URL.
        (v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https?:\/\/\S+$/i.test(v),
        "اللينك لازم يبدأ بـ / (صفحة في المنصة) أو https://"
      )
      .default(""),
    startsAt: z.string().datetime({ offset: true }).nullable().default(null),
    endsAt: z.string().datetime({ offset: true }).nullable().default(null),
  })
  .refine((v) => !v.enabled || v.text.length > 0, {
    message: "اكتب نص الإعلان قبل ما تشغّله",
    path: ["text"],
  })
  .refine(
    (v) => !v.startsAt || !v.endsAt || new Date(v.startsAt) < new Date(v.endsAt),
    { message: "تاريخ النهاية لازم يكون بعد تاريخ البداية", path: ["endsAt"] }
  );

/**
 * The popup a student sees when a course opens for them (paid, code, free).
 * {الاسم} / {الكورس} in the texts become the student's name / the course.
 * No lines hides the motivating box; one line is picked each time.
 */
export const welcomeSectionSchema = z.object({
  title: text(60, "العنوان"),
  message: text(160, "الرسالة"),
  lines: z.array(text(200, "الجملة التحفيزية")).max(8, "أقصى عدد ٨ جمل"),
});

export const SECTION_SCHEMAS: Record<SettingsSection, z.ZodTypeAny> = {
  theme: themeSectionSchema,
  typography: typographySectionSchema,
  hero: heroSectionSchema,
  whyUs: whyUsSectionSchema,
  faq: faqSectionSchema,
  contact: contactSectionSchema,
  announcement: announcementSectionSchema,
  welcome: welcomeSectionSchema,
};

export const sectionParamsSchema = z.object({
  section: z.enum(SETTINGS_SECTIONS),
});

export const assetParamsSchema = z.object({
  palette: z.enum(PALETTES),
  slot: z.enum(ASSET_SLOTS),
});
