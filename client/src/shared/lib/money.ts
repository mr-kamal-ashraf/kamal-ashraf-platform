/**
 * Money formatting for the admin panel.
 *
 * Amounts are stored as whole Egyptian pounds throughout the platform, so the
 * only job here is grouping the digits and attaching the currency in Arabic.
 */

/** e.g. 12500 → "١٢٬٥٠٠ ج.م" */
export function formatEgp(amount: number): string {
  return `${Math.round(amount).toLocaleString("ar-EG")} ج.م`;
}

/** Digits only, for table cells where the column header already says the unit. */
export function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString("ar-EG");
}
