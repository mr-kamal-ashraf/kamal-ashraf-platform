import type { FontKey } from "@/config/fonts";
import type { Palette } from "@/config/theme";

/*
 * Shapes of the appearance & content settings the teacher edits from the
 * admin panel. The backend stores OVERRIDES only: any section that is `null`
 * falls back to the defaults in ./defaults.ts.
 */

export type ThemeMode = "light" | "dark" | "system";
export type AssetSlot = "logo" | "logoDark" | "hero";

export interface ThemeSettings {
  palette: Palette;
  defaultMode: ThemeMode;
  allowModeToggle: boolean;
}

export interface TypographySettings {
  font: FontKey;
}

export interface HeroStat {
  value: number;
  prefix: string;
  suffix: string;
  label: string;
  visible: boolean;
}

export interface HeroSettings {
  badge: string;
  line1: string;
  line2: string;
  /** Words / phrases of line 1 or line 2, each written exactly as there; shown
   *  in the brand colour (see headline.ts). Older saves had one `highlight`. */
  highlights: string[];
  /** Legacy: words before line 2, now merged into line2 when settings are read.
   *  Always "" once resolved, so a save clears it. */
  line2Prefix: string;
  /** Plain text; wrap words in **double asterisks** to make them bold. */
  description: string;
  primaryCta: string;
  secondaryCta: string;
  stats: HeroStat[];
}

export interface WhyUsItem {
  title: string;
  emoji: string;
  description: string;
}

export interface WhyUsSettings {
  items: WhyUsItem[];
  goal: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqSettings {
  items: FaqItem[];
}

export interface ContactSettings {
  phone: string;
  whatsapp: string;
  email: string;
  facebook: string;
  instagram: string;
  youtube: string;
  tiktok: string;
  telegram: string;
}

export interface AnnouncementSettings {
  enabled: boolean;
  text: string;
  linkLabel: string;
  linkUrl: string;
  startsAt: string | null;
  endsAt: string | null;
}

/**
 * The popup a student sees when a course opens for them. {الاسم} / {الكورس}
 * in the texts become the student's name / the course (see ./welcome.ts).
 */
export interface WelcomeSettings {
  title: string;
  message: string;
  /** Motivating lines — one is picked each time; none hides the box. */
  lines: string[];
}

/** What the API returns: every section may be null (= use defaults). */
export interface RawSiteSettings {
  theme: ThemeSettings | null;
  typography: TypographySettings | null;
  hero: HeroSettings | null;
  whyUs: WhyUsSettings | null;
  faq: FaqSettings | null;
  contact: ContactSettings | null;
  announcement: AnnouncementSettings | null;
  welcome: WelcomeSettings | null;
  assets: Partial<Record<Palette, Partial<Record<AssetSlot, string | null>>>>;
  favicon: string | null;
  updatedAt: string | null;
}

export type SettingsSection =
  | "theme"
  | "typography"
  | "hero"
  | "whyUs"
  | "faq"
  | "contact"
  | "announcement"
  | "welcome";

export interface ResolvedAssets {
  logo: string;
  logoDark?: string;
  hero: string;
  portrait?: string;
}

/** Settings with every default filled in — what the website renders. */
export interface SiteSettings {
  theme: ThemeSettings;
  typography: TypographySettings;
  /** Images for the ACTIVE palette. */
  assets: ResolvedAssets;
  /** Images for every palette (the admin editor shows all of them). */
  paletteAssets: Record<Palette, ResolvedAssets>;
  favicon: string;
  hero: HeroSettings;
  whyUs: WhyUsSettings;
  faq: FaqSettings;
  contact: ContactSettings & { whatsappLink: string; telLink: string };
  announcement: AnnouncementSettings;
  welcome: WelcomeSettings;
  updatedAt: string | null;
}
