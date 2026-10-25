/**
 * Whether next/image may resize this picture: our own files (/…) and the
 * Cloudinary host allow-listed in next.config.ts. Anything else — old uploads
 * served by the API, blob:/data: previews of a file being picked — is shown
 * as it is: pass `unoptimized={!isOptimizable(src)}`.
 */
export function isOptimizable(src: string): boolean {
  if (src.startsWith("/")) return !src.startsWith("//");
  return src.startsWith("https://res.cloudinary.com/");
}
