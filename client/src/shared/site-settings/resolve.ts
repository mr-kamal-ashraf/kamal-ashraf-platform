import { isFontKey } from "@/config/fonts";
import {
  PALETTE_ASSETS,
  PALETTES,
  isPalette,
  type Palette,
} from "@/config/theme";
import {
  DEFAULT_ANNOUNCEMENT,
  DEFAULT_CONTACT,
  DEFAULT_FAQ,
  DEFAULT_HERO,
  DEFAULT_THEME,
  DEFAULT_TYPOGRAPHY,
  DEFAULT_WELCOME,
  DEFAULT_WHY_US,
} from "./defaults";
import { MAX_HEADLINE_HIGHLIGHTS } from "./headline";
import type {
  AnnouncementSettings,
  ContactSettings,
  FaqSettings,
  HeroSettings,
  RawSiteSettings,
  ResolvedAssets,
  SiteSettings,
  ThemeSettings,
  TypographySettings,
  WelcomeSettings,
  WhyUsSettings,
} from "./types";

/** Digits only, with an Egyptian local number (01…) turned into 201…. */
function internationalDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `2${digits}`;
  return digits;
}

export function whatsappLinkFor(phone: string): string {
  const d = internationalDigits(phone);
  return d ? `https://wa.me/${d}` : "";
}

export function telLinkFor(phone: string): string {
  const d = internationalDigits(phone);
  return d ? `tel:+${d}` : "";
}

/*
 * Defensive readers: the API validates every write, but the website must
 * never crash because of one odd value (an old document shape, a manual DB
 * edit, a half-written section). Anything missing or of the wrong type falls
 * back to the default for that one field.
 */
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback: string) =>
  typeof v === "string" ? v : fallback;
const bool = (v: unknown, fallback: boolean) =>
  typeof v === "boolean" ? v : fallback;
const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
const WEB_URL_RE = /^https?:\/\/\S+$/i;
/** Social links must be plain http(s) URLs — anything else is dropped. */
const webUrl = (v: unknown, fallback: string) =>
  typeof v === "string" ? (v === "" || WEB_URL_RE.test(v) ? v : "") : fallback;
/** Announcement link: a page on the site ("/courses") or an http(s) URL. */
const linkUrl = (v: unknown, fallback: string) => {
  if (typeof v !== "string") return fallback;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return WEB_URL_RE.test(v) ? v : "";
};
const isoOrNull = (v: unknown) =>
  typeof v === "string" && !Number.isNaN(new Date(v).getTime()) ? v : null;

/**
 * Only images next/image is allowed to load: files shipped in /public, or
 * uploads on Cloudinary (next.config.ts remotePatterns). Anything else would
 * throw at render time, so it falls back to the shipped image.
 */
function safeImage(v: unknown, fallback: string): string;
function safeImage(
  v: unknown,
  fallback: string | undefined,
): string | undefined;
function safeImage(v: unknown, fallback: string | undefined) {
  if (typeof v !== "string" || !v) return fallback;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  if (v.startsWith("https://res.cloudinary.com/")) return v;
  return fallback;
}

function readTheme(v: unknown): ThemeSettings {
  if (!isObj(v)) return DEFAULT_THEME;
  const mode = v.defaultMode;
  return {
    palette: isPalette(v.palette) ? v.palette : DEFAULT_THEME.palette,
    defaultMode:
      mode === "light" || mode === "dark" || mode === "system"
        ? mode
        : DEFAULT_THEME.defaultMode,
    allowModeToggle: bool(v.allowModeToggle, DEFAULT_THEME.allowModeToggle),
  };
}

function readTypography(v: unknown): TypographySettings {
  if (!isObj(v)) return DEFAULT_TYPOGRAPHY;
  return { font: isFontKey(v.font) ? v.font : DEFAULT_TYPOGRAPHY.font };
}

/** الكلمات الملونة — a list now; an older save had a single `highlight`. */
function readHighlights(v: Record<string, unknown>, fallback: string[]): string[] {
  if (Array.isArray(v.highlights)) {
    const list = v.highlights
      .filter((h): h is string => typeof h === "string" && h.trim() !== "")
      .slice(0, MAX_HEADLINE_HIGHLIGHTS);
    if (list.length > 0) return list;
  }
  const single = str(v.highlight, "").trim();
  return single ? [single] : fallback;
}

function readHero(v: unknown): HeroSettings {
  if (!isObj(v)) return DEFAULT_HERO;
  const d = DEFAULT_HERO;
  const stats = Array.isArray(v.stats) ? v.stats : [];
  // Older saves split line 2 into a prefix ("مع") + the rest; it is one line now.
  const prefix = str(v.line2Prefix, "").trim();
  const line2 = str(v.line2, d.line2);
  return {
    badge: str(v.badge, d.badge),
    line1: str(v.line1, d.line1),
    line2: prefix ? `${prefix} ${line2}` : line2,
    highlights: readHighlights(v, d.highlights),
    line2Prefix: "",
    description: str(v.description, d.description),
    primaryCta: str(v.primaryCta, d.primaryCta),
    secondaryCta: str(v.secondaryCta, d.secondaryCta),
    stats: d.stats.map((ds, i) => {
      const s = stats[i];
      if (!isObj(s)) return ds;
      return {
        value: num(s.value, ds.value),
        prefix: str(s.prefix, ds.prefix),
        suffix: str(s.suffix, ds.suffix),
        label: str(s.label, ds.label),
        visible: bool(s.visible, ds.visible),
      };
    }),
  };
}

function readWhyUs(v: unknown): WhyUsSettings {
  if (!isObj(v)) return DEFAULT_WHY_US;
  const items = Array.isArray(v.items) ? v.items : [];
  return {
    items: DEFAULT_WHY_US.items.map((di, i) => {
      const it = items[i];
      if (!isObj(it)) return di;
      return {
        title: str(it.title, di.title),
        emoji: str(it.emoji, di.emoji),
        description: str(it.description, di.description),
      };
    }),
    goal: str(v.goal, DEFAULT_WHY_US.goal),
  };
}

function readFaq(v: unknown): FaqSettings {
  if (!isObj(v) || !Array.isArray(v.items)) return DEFAULT_FAQ;
  // An empty list is a valid choice (the teacher hid the section).
  return {
    items: v.items
      .filter(
        (it): it is Obj =>
          isObj(it) && typeof it.q === "string" && typeof it.a === "string",
      )
      .map((it) => ({ q: it.q as string, a: it.a as string })),
  };
}

function readContact(v: unknown): ContactSettings {
  if (!isObj(v)) return DEFAULT_CONTACT;
  const d = DEFAULT_CONTACT;
  return {
    phone: str(v.phone, d.phone),
    whatsapp: str(v.whatsapp, d.whatsapp),
    email: str(v.email, d.email),
    facebook: webUrl(v.facebook, d.facebook),
    instagram: webUrl(v.instagram, d.instagram),
    youtube: webUrl(v.youtube, d.youtube),
    tiktok: webUrl(v.tiktok, d.tiktok),
    telegram: webUrl(v.telegram, d.telegram),
  };
}

function readAnnouncement(v: unknown): AnnouncementSettings {
  if (!isObj(v)) return DEFAULT_ANNOUNCEMENT;
  const d = DEFAULT_ANNOUNCEMENT;
  return {
    enabled: bool(v.enabled, d.enabled),
    text: str(v.text, d.text),
    linkLabel: str(v.linkLabel, d.linkLabel),
    linkUrl: linkUrl(v.linkUrl, d.linkUrl),
    startsAt: isoOrNull(v.startsAt),
    endsAt: isoOrNull(v.endsAt),
  };
}

function readWelcome(v: unknown): WelcomeSettings {
  if (!isObj(v)) return DEFAULT_WELCOME;
  const d = DEFAULT_WELCOME;
  const title = str(v.title, "").trim();
  const message = str(v.message, "").trim();
  return {
    title: title || d.title,
    message: message || d.message,
    // No lines is a valid choice (the teacher hid the box).
    lines: Array.isArray(v.lines)
      ? v.lines.filter(
          (l): l is string => typeof l === "string" && l.trim() !== "",
        )
      : d.lines,
  };
}

/**
 * Merges what the teacher saved over the built-in defaults. Each section is
 * saved as a whole, so a section is either the saved one or the default one
 * (with any unreadable field replaced by its default).
 */
export function resolveSiteSettings(
  raw: RawSiteSettings | null | undefined,
): SiteSettings {
  const r: Obj = isObj(raw) ? raw : {};
  const theme = readTheme(r.theme);
  const savedAssets = isObj(r.assets) ? r.assets : {};

  const paletteAssets = Object.fromEntries(
    PALETTES.map((p) => {
      const shipped = PALETTE_ASSETS[p];
      const saved = isObj(savedAssets[p]) ? (savedAssets[p] as Obj) : {};
      const resolved: ResolvedAssets = {
        logo: safeImage(saved.logo, shipped.logo),
        logoDark: safeImage(saved.logoDark, shipped.logoDark),
        hero: safeImage(saved.hero, shipped.hero),
        portrait: shipped.portrait,
      };
      return [p, resolved];
    }),
  ) as Record<Palette, ResolvedAssets>;

  const assets = paletteAssets[theme.palette];
  const contact = readContact(r.contact);

  return {
    theme,
    typography: readTypography(r.typography),
    assets,
    paletteAssets,
    favicon: safeImage(r.favicon, assets.logo),
    hero: readHero(r.hero),
    whyUs: readWhyUs(r.whyUs),
    faq: readFaq(r.faq),
    contact: {
      ...contact,
      whatsappLink: whatsappLinkFor(contact.whatsapp),
      telLink: telLinkFor(contact.phone),
    },
    announcement: readAnnouncement(r.announcement),
    welcome: readWelcome(r.welcome),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
  };
}

/** True when the announcement should show right now (enabled, has text, within dates). */
export function isAnnouncementLive(
  a: AnnouncementSettings,
  now = new Date(),
): boolean {
  if (!a.enabled || !a.text.trim()) return false;
  if (a.startsAt && new Date(a.startsAt) > now) return false;
  if (a.endsAt && new Date(a.endsAt) <= now) return false;
  return true;
}
