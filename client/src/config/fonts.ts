/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PLATFORM FONTS
 * ─────────────────────────────────────────────────────────────────────────────
 *  The teacher picks the platform font from the admin panel
 *  (/admin/appearance → الخطوط). DEFAULT_FONT is used until one is chosen;
 *  the admin panel itself always uses ADMIN_FONT.
 *
 *  This file is the single list of fonts. The font files are self-hosted in
 *  public/fonts/<key>/ and their @font-face CSS lives in fonts.generated.ts;
 *  both are produced from this list by `npm run fonts:fetch`. The root layout
 *  inlines the CSS of the ACTIVE font only (plus ADMIN_FONT for the admin
 *  panel) and preloads its Arabic file, so a visitor never pays for the rest.
 *
 *  To add a font: add its key below, an entry in FONT_META (`google` = the
 *  Google Fonts weight axis to fetch), run `npm run fonts:fetch`, and add the
 *  key to the server list (server/src/modules/site-settings/site-settings.model.ts
 *  → FONTS). TypeScript fails the build until the generated CSS exists.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const FONTS = [
  "cairo",
  "tajawal",
  "almarai",
  "ibm-plex",
  "noto-kufi",
  "readex",
  "alexandria",
  "vazirmatn",
  "rubik",
  "beiruti",
  "zain",
  "mada",
  "baloo",
  "marhey",
  "lemonada",
  "playpen",
  "changa",
  "kufam",
  "el-messiri",
  "reem-kufi",
] as const;

export type FontKey = (typeof FONTS)[number];

/** The website's font until the teacher picks another one. */
export const DEFAULT_FONT: FontKey = "cairo";

/** The admin panel's own font — it doesn't follow the teacher's pick. */
export const ADMIN_FONT: FontKey = "cairo";

export type FontGroup = "clean" | "playful" | "elegant";

export const FONT_GROUPS: Record<FontGroup, { label: string; hint: string }> = {
  clean: { label: "هادية وعصرية", hint: "مريحة للقراية الطويلة وشكلها نضيف" },
  playful: { label: "روشة ومميزة", hint: "فيها شخصية وروح شبابية" },
  elegant: { label: "أنيقة", hint: "طابع راقي وكلاسيكي شوية" },
};

export interface FontMeta {
  /** Arabic name shown in the admin picker. */
  label: string;
  /** Google Fonts family name — also the CSS font-family. */
  family: string;
  group: FontGroup;
  /**
   * Size correction. Fonts differ a lot in width (Lemonada is ~30% wider
   * than Cairo, Beiruti ~25% narrower), so each one is scaled to take about
   * the same room as Cairo — measured on the hero heading and body text, kept
   * within 0.8–1.2. styles.css multiplies every text size by it
   * (--font-scale), so layouts hold whatever font is picked.
   */
  scale: number;
  /**
   * Minimum line-height that keeps stacked lines from touching: the font's
   * tallest Arabic ascender (أ آ ل) + deepest descender (ح ج ي ع), measured
   * in em at regular and heavy weight, + 0.05 clearance. Fonts differ a lot
   * (El Messiri needs 1.19, Lemonada 1.66), and Tailwind's heading defaults
   * (1.0–1.25) are made for Latin. styles.css raises every line-height to
   * at least this (--font-leading); lines that already have room are untouched.
   */
  leading: number;
  /** Google Fonts css2 weight axis to download: a range (variable) or a list. */
  google: string;
}

export const FONT_META: Record<FontKey, FontMeta> = {
  cairo: {
    label: "كايرو",
    family: "Cairo",
    group: "clean",
    scale: 1,
    leading: 1.4,
    google: "wght@200..1000",
  },
  tajawal: {
    label: "تجوال",
    family: "Tajawal",
    group: "clean",
    scale: 1,
    leading: 1.28,
    google: "wght@400;500;700;800;900",
  },
  almarai: {
    label: "المراعي",
    family: "Almarai",
    group: "clean",
    scale: 1,
    leading: 1.43,
    google: "wght@300;400;700;800",
  },
  "ibm-plex": {
    label: "آي بي إم بلكس",
    family: "IBM Plex Sans Arabic",
    group: "clean",
    scale: 1.06,
    leading: 1.27,
    google: "wght@400;500;600;700",
  },
  "noto-kufi": {
    label: "نوتو كوفي",
    family: "Noto Kufi Arabic",
    group: "clean",
    scale: 0.91,
    leading: 1.41,
    google: "wght@100..900",
  },
  readex: {
    label: "ريدكس برو",
    family: "Readex Pro",
    group: "clean",
    scale: 0.95,
    leading: 1.54,
    google: "wght@160..700",
  },
  alexandria: {
    label: "الإسكندرية",
    family: "Alexandria",
    group: "clean",
    scale: 0.9,
    leading: 1.57,
    google: "wght@100..900",
  },
  vazirmatn: {
    label: "وزيرمتن",
    family: "Vazirmatn",
    group: "clean",
    scale: 1.04,
    leading: 1.31,
    google: "wght@100..900",
  },
  rubik: {
    label: "روبيك",
    family: "Rubik",
    group: "clean",
    scale: 1,
    leading: 1.34,
    google: "wght@300..900",
  },
  beiruti: {
    label: "بيروتي",
    family: "Beiruti",
    group: "clean",
    scale: 1.18,
    leading: 1.19,
    google: "wght@200..900",
  },
  zain: {
    label: "زين",
    family: "Zain",
    group: "clean",
    scale: 0.95,
    leading: 1.47,
    google: "wght@400;700;800;900",
  },
  mada: {
    label: "مدى",
    family: "Mada",
    group: "clean",
    scale: 1.1,
    leading: 1.29,
    google: "wght@200..900",
  },
  baloo: {
    label: "بالو بهيجان",
    family: "Baloo Bhaijaan 2",
    group: "playful",
    scale: 1.05,
    leading: 1.41,
    google: "wght@400..800",
  },
  marhey: {
    label: "مرحى",
    family: "Marhey",
    group: "playful",
    scale: 1,
    leading: 1.42,
    google: "wght@300..700",
  },
  lemonada: {
    label: "ليمونادة",
    family: "Lemonada",
    group: "playful",
    scale: 0.8,
    leading: 1.66,
    google: "wght@300..700",
  },
  playpen: {
    label: "بلاي بن",
    family: "Playpen Sans Arabic",
    group: "playful",
    scale: 1.03,
    leading: 1.41,
    google: "wght@100..800",
  },
  changa: {
    label: "تشانجا",
    family: "Changa",
    group: "playful",
    scale: 0.98,
    leading: 1.31,
    google: "wght@200..800",
  },
  kufam: {
    label: "كوفام",
    family: "Kufam",
    group: "playful",
    scale: 0.9,
    leading: 1.32,
    google: "wght@400..900",
  },
  "el-messiri": {
    label: "المسيري",
    family: "El Messiri",
    group: "elegant",
    scale: 1,
    leading: 1.19,
    google: "wght@400..700",
  },
  "reem-kufi": {
    label: "ريم كوفي",
    family: "Reem Kufi",
    group: "elegant",
    scale: 1.15,
    leading: 1.28,
    google: "wght@400..700",
  },
};

export function isFontKey(value: unknown): value is FontKey {
  return (
    typeof value === "string" && (FONTS as readonly string[]).includes(value)
  );
}

/** CSS font-family value for a font (its self-hosted @font-face family). */
export function fontFamily(key: FontKey): string {
  return `"${FONT_META[key].family}"`;
}

/** The stylesheet with a font's @font-face rules (used by the admin previews). */
export function fontStylesheet(key: FontKey): string {
  return `/fonts/${key}/font.css`;
}

/** Inline CSS variables that switch the platform (or one preview) to a font. */
export function fontStyleVars(
  key: FontKey,
): Record<"--font-active" | "--font-scale" | "--font-leading", string> {
  const { scale, leading } = FONT_META[key];
  return {
    "--font-active": fontFamily(key),
    "--font-scale": String(scale),
    "--font-leading": String(leading),
  };
}
