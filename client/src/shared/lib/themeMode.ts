import type { ThemeMode } from "@/shared/site-settings/types";

/*
 * Light / dark mode. The admin panel keeps its own choice, apart from the
 * site's: switching the panel to dark never turns the site dark, and back.
 */

/** Where the choice for this page's side (site or admin panel) is kept. */
export const themeStorageKey = (pathname: string) =>
  pathname.startsWith("/admin") ? "admin-theme" : "theme";

/**
 * Picks the mode for the current page and applies it.
 *  - Site: the visitor's choice when the teacher allows the toggle; otherwise
 *    (or before they choose) the teacher's default — "system" follows the device.
 *  - Admin panel: its own saved choice, light until one is made.
 * With storage blocked it leaves the page as it is.
 *
 * Self-contained on purpose (no imports, nothing from outside): layout.tsx
 * also inlines it as the script that runs before first paint, so the page
 * never flashes the wrong mode. That is also why it repeats themeStorageKey's
 * "/admin" rule, and why its body has no comments (they would ship in every page).
 */
export function applyThemeMode(defaultMode: ThemeMode, allowToggle: boolean) {
  try {
    const admin = window.location.pathname.startsWith("/admin");
    const saved = window.localStorage.getItem(admin ? "admin-theme" : "theme");
    const chosen = (admin || allowToggle) && (saved === "light" || saved === "dark") ? saved : null;
    const fallback = admin
      ? "light"
      : defaultMode === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : defaultMode;
    document.documentElement.classList.toggle("dark", (chosen ?? fallback) === "dark");
  } catch {
    return;
  }
}
