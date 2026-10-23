import { DEFAULT_FONT } from "@/config/fonts";
import { DEFAULT_PALETTE } from "@/config/theme";
import { SITE } from "@/shared/i18n/site";
import type {
  AnnouncementSettings,
  ContactSettings,
  FaqSettings,
  HeroSettings,
  ThemeSettings,
  TypographySettings,
  WelcomeSettings,
  WhyUsSettings,
} from "./types";
import { WELCOME_COURSE_TOKEN, WELCOME_NAME_TOKEN } from "./welcome";

/*
 * What the website shows for any section the teacher hasn't edited yet.
 * These mirror the content that shipped with the platform, so an empty
 * settings collection renders the site exactly as before.
 */

export const DEFAULT_THEME: ThemeSettings = {
  palette: DEFAULT_PALETTE,
  defaultMode: "light",
  allowModeToggle: true,
};

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  font: DEFAULT_FONT,
};

export const DEFAULT_HERO: HeroSettings = {
  badge: `منصة ${SITE.teacherName} الرسمية`,
  line1: "منصتك الأولى في الأحياء والجولوجيا مع أستاذ",
  line2: "كمال أشرف",
  highlights: ["الأحياء والجولوجيا"],
  line2Prefix: "",
  description: `دروس **شرح شامل** و**مراجعات نهائية** و**امتحانات على المنهج كامل** — مع ${SITE.teacherName} — بأسلوب يخليك تفهم مش تحفظ، وتدخل الامتحان واثق.`,
  primaryCta: "ابدأ رحلتك دلوقتي",
  secondaryCta: "شوف الكورسات",
  stats: SITE.stats.map((s) => ({
    value: s.value,
    prefix: s.prefix,
    suffix: s.suffix,
    label: s.label,
    visible: true,
  })),
};

export const DEFAULT_WHY_US: WhyUsSettings = {
  items: SITE.whyUs.map((w) => ({
    title: w.title,
    emoji: w.emoji,
    description: w.description,
  })),
  goal: SITE.whyUsGoal,
};

export const DEFAULT_FAQ: FaqSettings = {
  items: SITE.faq.map((f) => ({ q: f.q, a: f.a })),
};

export const DEFAULT_CONTACT: ContactSettings = {
  phone: SITE.contact.phone,
  whatsapp: SITE.contact.whatsapp,
  email: "",
  facebook: SITE.contact.facebook,
  instagram: "",
  youtube: "",
  tiktok: "",
  telegram: "",
};

export const DEFAULT_ANNOUNCEMENT: AnnouncementSettings = {
  enabled: false,
  text: "",
  linkLabel: "",
  linkUrl: "",
  startsAt: null,
  endsAt: null,
};

export const DEFAULT_WELCOME: WelcomeSettings = {
  title: `مبروك يا ${WELCOME_NAME_TOKEN}!`,
  message: `كورس «${WELCOME_COURSE_TOKEN}» بقى بتاعك.`,
  lines: [
    "أول خطوة هي أصعب خطوة — وانت عملتها. يلا نكمّلها مع بعض 💪",
    "الأحياء مش حفظ… هنفهمها سوا خطوة بخطوة لحد الدرجة النهائية.",
    "كل درس بتخلّصه بيقرّبك من حلمك. خلّي الحماس ده مستمر!",
    "جهّز كشكولك وقلمك ✍️ — أول درس مستنيك.",
  ],
};
