import {
  heroHeadline,
  samePhrase,
  MAX_HEADLINE_HIGHLIGHTS,
  type AnnouncementSettings,
  type ContactSettings,
  type FaqSettings,
  type HeroSettings,
  type WelcomeSettings,
  type WhyUsSettings,
} from "@/shared/site-settings";

/*
 * Client-side checks that mirror the server's Zod schemas
 * (server/src/modules/site-settings/site-settings.validation.ts), so the
 * teacher sees exactly which box is wrong — in red, next to it — before
 * anything is sent. The server still validates everything.
 *
 * Keys are field paths: "badge", "stats.0.label", "items.2.q", …
 */
export type FieldErrors = Record<string, string>;

const URL_RE = /^https?:\/\/\S+$/i;
const PHONE_RE = /^[+\d\s()-]{6,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireText(errors: FieldErrors, key: string, value: string, label: string, max: number) {
  const v = value.trim();
  if (!v) errors[key] = `${label} مطلوب`;
  else if (v.length > max) errors[key] = `${label} طويل جداً (أقصى حد ${max} حرف)`;
}

function maxText(errors: FieldErrors, key: string, value: string, label: string, max: number) {
  if (value.trim().length > max) errors[key] = `${label} طويل جداً (أقصى حد ${max} حرف)`;
}

export function validateHero(h: HeroSettings): FieldErrors {
  const e: FieldErrors = {};
  requireText(e, "badge", h.badge, "نص البادج", 80);
  requireText(e, "line1", h.line1, "السطر الأول", 60);
  requireText(e, "line2", h.line2, "السطر التاني", 60);
  const { found } = heroHeadline(h);
  if (h.highlights.length === 0) e.highlights = "لازم كلمة ملونة واحدة على الأقل";
  if (h.highlights.length > MAX_HEADLINE_HIGHLIGHTS) {
    e.highlights = `أقصى عدد ${MAX_HEADLINE_HIGHLIGHTS} كلمات ملونة`;
  }
  h.highlights.forEach((word, i) => {
    const key = `highlights.${i}`;
    requireText(e, key, word, "الكلمة الملونة", 40);
    if (e[key]) return;
    if (h.highlights.slice(0, i).some((other) => samePhrase(other, word))) {
      e[key] = "الكلمة دي مكتوبة قبل كده في القايمة.";
    } else if (!found[i]) {
      e[key] = "الكلمة دي لازم تكون مكتوبة زي ما هي في السطر الأول أو السطر التاني.";
    }
  });
  requireText(e, "description", h.description, "الوصف", 400);
  requireText(e, "primaryCta", h.primaryCta, "نص الزرار", 40);
  requireText(e, "secondaryCta", h.secondaryCta, "نص الزرار", 40);
  h.stats.forEach((s, i) => {
    requireText(e, `stats.${i}.label`, s.label, "وصف الرقم", 30);
    if (!Number.isInteger(s.value) || s.value < 0 || s.value > 100_000_000) {
      e[`stats.${i}.value`] = "اكتب رقم صحيح من 0 لـ 100,000,000";
    }
  });
  return e;
}

export function validateWhyUs(w: WhyUsSettings): FieldErrors {
  const e: FieldErrors = {};
  w.items.forEach((it, i) => {
    requireText(e, `items.${i}.title`, it.title, "العنوان", 60);
    requireText(e, `items.${i}.description`, it.description, "الوصف", 400);
  });
  requireText(e, "goal", w.goal, "جملة الهدف", 240);
  return e;
}

export function validateFaq(f: FaqSettings): FieldErrors {
  const e: FieldErrors = {};
  f.items.forEach((it, i) => {
    requireText(e, `items.${i}.q`, it.q, "السؤال", 200);
    requireText(e, `items.${i}.a`, it.a, "الإجابة", 1500);
  });
  return e;
}

const SOCIAL_NAMES: Partial<Record<keyof ContactSettings, string>> = {
  facebook: "فيسبوك",
  instagram: "إنستجرام",
  youtube: "يوتيوب",
  tiktok: "تيك توك",
  telegram: "تيليجرام",
};

export function validateContact(c: ContactSettings): FieldErrors {
  const e: FieldErrors = {};
  for (const key of ["phone", "whatsapp"] as const) {
    const v = c[key].trim();
    if (v && !PHONE_RE.test(v)) e[key] = "الرقم مش صحيح — أرقام بس (ممكن + أو مسافات)";
  }
  const email = c.email.trim();
  if (email && !EMAIL_RE.test(email)) e.email = "الإيميل مش صحيح";
  for (const [key, name] of Object.entries(SOCIAL_NAMES) as Array<[keyof ContactSettings, string]>) {
    const v = c[key].trim();
    if (v.length > 300) e[key] = `لينك ${name} طويل جداً`;
    else if (v && !URL_RE.test(v)) e[key] = `لينك ${name} لازم يبدأ بـ https://`;
  }
  return e;
}

export function validateAnnouncement(a: AnnouncementSettings): FieldErrors {
  const e: FieldErrors = {};
  if (a.enabled && !a.text.trim()) e.text = "اكتب نص الإعلان قبل ما تشغّله";
  maxText(e, "text", a.text, "نص الإعلان", 160);
  maxText(e, "linkLabel", a.linkLabel, "نص اللينك", 30);
  const url = a.linkUrl.trim();
  const sitePage = url.startsWith("/") && !url.startsWith("//");
  if (url && !sitePage && !URL_RE.test(url)) {
    e.linkUrl = "اللينك لازم يبدأ بـ / (صفحة في المنصة) أو https://";
  }
  if (a.startsAt && a.endsAt && new Date(a.startsAt) >= new Date(a.endsAt)) {
    e.endsAt = "تاريخ النهاية لازم يكون بعد تاريخ البداية";
  }
  return e;
}

export function validateWelcome(w: WelcomeSettings): FieldErrors {
  const e: FieldErrors = {};
  requireText(e, "title", w.title, "العنوان", 60);
  requireText(e, "message", w.message, "الرسالة", 160);
  w.lines.forEach((line, i) => {
    requireText(e, `lines.${i}`, line, "الجملة التحفيزية", 200);
  });
  if (w.lines.length > 8) e.lines = "أقصى عدد ٨ جمل";
  return e;
}
