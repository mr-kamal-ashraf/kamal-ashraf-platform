export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

/**
 * The website's public address — canonical URLs, the sitemap, share links and
 * structured data are built from it. Set NEXT_PUBLIC_SITE_URL in production
 * (e.g. https://kamalashraf.com).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

export const API_ORIGIN = (() => {
  try {
    return new URL(API_URL).origin;
  } catch {
    return "http://localhost:5000";
  }
})();

export function resolveAssetUrl(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return `${API_ORIGIN}${path}`;
  return `${API_ORIGIN}/${path}`;
}
