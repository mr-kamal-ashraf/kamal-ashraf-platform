/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  COLOR PALETTES
 * ─────────────────────────────────────────────────────────────────────────────
 *  The teacher picks the active palette from the admin panel
 *  (/admin/appearance). DEFAULT_PALETTE is only the fallback used until a
 *  palette has been chosen there (or if the settings can't be loaded).
 *
 *  Each palette's colors live in src/styles.css under
 *  `:root[data-palette="<name>"]` (light) and `:root[data-palette="<name>"].dark`.
 *
 *    "green"     — deep forest green + copper highlight
 *    "burgundy"  — deep wine burgundy + champagne-gold highlight
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const PALETTES = ["green", "burgundy"] as const;

export type Palette = (typeof PALETTES)[number];

export const DEFAULT_PALETTE: Palette = "burgundy";

/** Arabic names + swatches for the admin palette picker (approximate token colors). */
export const PALETTE_META: Record<
  Palette,
  {
    label: string;
    description: string;
    light: {
      bg: string;
      card: string;
      primary: string;
      highlight: string;
      text: string;
    };
    dark: {
      bg: string;
      card: string;
      primary: string;
      highlight: string;
      text: string;
    };
  }
> = {
  green: {
    label: "الأخضر الغامق",
    description: "أخضر غابات مع لمسة نحاسي",
    light: {
      bg: "oklch(0.974 0.012 100)",
      card: "oklch(0.993 0.006 100)",
      primary: "oklch(0.42 0.1 158)",
      highlight: "oklch(0.56 0.13 48)",
      text: "oklch(0.22 0.045 160)",
    },
    dark: {
      bg: "oklch(0.185 0.006 160)",
      card: "oklch(0.218 0.007 160)",
      primary: "oklch(0.7 0.065 158)",
      highlight: "oklch(0.77 0.055 55)",
      text: "oklch(0.93 0.008 70)",
    },
  },
  burgundy: {
    label: "البرجندي",
    description: "نبيتي برجندي مع لمسة ذهبي شمباني",
    light: {
      bg: "oklch(0.972 0.012 50)",
      card: "oklch(0.992 0.006 50)",
      primary: "oklch(0.4 0.12 12)",
      highlight: "oklch(0.57 0.085 72)",
      text: "oklch(0.22 0.05 15)",
    },
    dark: {
      bg: "oklch(0.185 0.008 15)",
      card: "oklch(0.218 0.01 15)",
      primary: "oklch(0.43 0.125 14)",
      highlight: "oklch(0.77 0.055 78)",
      text: "oklch(0.93 0.008 60)",
    },
  },
};

/**
 * Images that ship with each palette (public/assets/palettes/). The teacher can
 * replace any of them from the admin panel; these are the fallbacks.
 *  - logo: wide logo for the header / footer / browser tab
 *  - logoDark: optional separate logo for dark mode (otherwise `logo` is used)
 *  - hero: teacher portrait for the home hero (circular artwork, transparent PNG)
 *  - portrait: optional photo for an "about the teacher" section (otherwise `hero`)
 */
export interface PaletteAssets {
  logo: string;
  logoDark?: string;
  hero: string;
  portrait?: string;
}

const BURGUNDY_ASSETS: PaletteAssets = {
  logo: "/assets/palettes/burgandy/kamal-ashraf-logo-burgandy.png",
  hero: "/assets/palettes/burgandy/kamal-ashraf-burgandy.png",
};

const GREEN_ASSETS: PaletteAssets = {
  logo: "/assets/palettes/green/kamal-ashraf-logo-green.png",
  hero: "/assets/palettes/green/kamal-ashraf-green.png",
};

export const PALETTE_ASSETS: Record<Palette, PaletteAssets> = {
  green: GREEN_ASSETS,
  burgundy: BURGUNDY_ASSETS,
};

export function isPalette(value: unknown): value is Palette {
  return (
    typeof value === "string" && (PALETTES as readonly string[]).includes(value)
  );
}
