import type { MetadataRoute } from "next";
import { SITE } from "@/shared/i18n/site";
import { getSiteSettings } from "@/shared/site-settings/server";
import { SEO_DESCRIPTION } from "@/shared/seo/seo";

/** Each palette's main colour (its light-mode --primary in styles.css, as hex). */
const THEME_COLOR = {
  green: "#005d37",
  burgundy: "#7b2436",
} as const;

/**
 * /manifest.webmanifest — name, icon and colours for "Add to home screen" and
 * search engines, following the teacher's palette and favicon.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSiteSettings();
  return {
    name: SITE.brand,
    short_name: SITE.brandShort,
    description: SEO_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#fdf4ef",
    theme_color: THEME_COLOR[settings.theme.palette],
    categories: ["education"],
    icons: [{ src: settings.favicon, sizes: "any", purpose: "any" }],
  };
}
