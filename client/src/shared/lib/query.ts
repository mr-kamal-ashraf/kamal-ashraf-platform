/**
 * Helpers for driving list filters from the page's query string.
 *
 * Filters live in the URL so a dashboard card can link straight to a
 * pre-filtered list ("/admin/students?status=active"), and so the teacher can
 * bookmark or share a view they use often.
 */

/**
 * Reads a query param, returning it only when it is one of the allowed values.
 * A hand-edited or stale URL therefore falls back to the default instead of
 * sending a value the API would reject.
 */
export function readEnumParam<T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[],
): T | null {
  if (!raw) return null;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

/** Reads a free-text param, trimmed, or null when it is missing or blank. */
export function readTextParam(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Builds a "?a=1&b=2" suffix from the active filters, dropping empty values so
 * the URL only ever shows what the teacher actually selected.
 */
export function buildQuerySuffix(
  filters: Record<string, string | number | undefined | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
