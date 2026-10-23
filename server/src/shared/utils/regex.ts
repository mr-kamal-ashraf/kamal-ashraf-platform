/**
 * Escape every regex meta-character so user-supplied search terms
 * are matched literally and cannot trigger ReDoS via crafted patterns
 * like `(a+)+$`.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a safe case-insensitive Mongo `$regex` clause from a raw user term.
 * The term is trimmed, length-capped, and fully escaped.
 */
export function buildSafeRegex(term: string, maxLen = 80): RegExp {
  const trimmed = term.trim().slice(0, maxLen);
  return new RegExp(escapeRegex(trimmed), "i");
}
