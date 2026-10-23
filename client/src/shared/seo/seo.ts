import { SITE_URL } from "@/config/env";
import { SITE } from "@/shared/i18n/site";

/*
 * Search & share basics, in one place: the default title / description /
 * keywords Google and social previews use, the share image, and helpers for
 * absolute URLs and JSON-LD. Page-level metadata builds on these.
 */

export const SEO_TITLE = `${SITE.teacherName} — منصة الأحياء والجيولوجيا`;

export const SEO_DESCRIPTION =
  "منصة أستاذ كمال أشرف لشرح الأحياء والجيولوجيا لطلبة تالتة إعدادي وأولى ثانوي وتالتة ثانوي: شرح بالرسم والتجربة، مراجعات نهائية وامتحانات على المنهج كامل — فهم مش حفظ.";

/** The way students and parents search (Google itself ignores the meta tag, others don't). */
export const SEO_KEYWORDS = [
  "أستاذ كمال أشرف",
  "مستر كمال أشرف",
  "كمال أشرف أحياء",
  "مدرس أحياء",
  "مدرس أحياء ثانوية عامة",
  "أحياء تالتة ثانوي",
  "أحياء أولى ثانوي",
  "جيولوجيا تالتة ثانوي",
  "علوم تالتة إعدادي",
  "شرح أحياء",
  "مراجعة نهائية أحياء",
  "امتحانات أحياء",
  "كورسات أحياء أونلاين",
  "منصة تعليمية",
];

/** The 1200×630 share image (public/og-image.jpg). */
export const OG_IMAGE = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: `${SITE.teacherName} — الأحياء والجيولوجيا`,
};

/**
 * A page's Open Graph card. Next replaces (doesn't merge) the layout's
 * openGraph when a page sets its own, so the site-wide fields go in here.
 */
export function pageOpenGraph(og: {
  url: string;
  title: string;
  description: string;
  images?: { url: string; width?: number; height?: number; alt?: string }[];
  type?: "website" | "article";
}) {
  return {
    type: og.type ?? "website",
    locale: "ar_EG",
    siteName: SITE.brand,
    url: og.url,
    title: og.title,
    description: og.description,
    images: og.images ?? [OG_IMAGE],
  };
}

/** "/courses/x" → "https://site/courses/x". */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** An image the site serves itself ("/assets/…") or from elsewhere (full URL) → absolute. */
export function absoluteImage(
  src: string | null | undefined,
): string | undefined {
  if (!src) return undefined;
  return /^https?:\/\//i.test(src) ? src : absoluteUrl(src);
}

/** JSON-LD for a <script type="application/ld+json">, safe against "</script>" breakouts. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
