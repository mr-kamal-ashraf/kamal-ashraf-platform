/**
 * Calendar helpers pinned to the platform's real-world timezone (Egypt).
 *
 * The server runs on UTC in production, but "this month" and "today" must mean
 * what they mean in Cairo — otherwise the monthly commitment score and the
 * sales summary would roll over two or three hours early every night and show
 * the teacher the wrong month on the 1st of each month.
 */

/** IANA timezone the platform's calendar logic is anchored to. */
export const PLATFORM_TIMEZONE = "Africa/Cairo";

/** "2026-10-22 20:28" — an instant as Cairo's wall clock (for exports). */
export function formatCairoDateTime(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")} ${String(Number(read("hour")) % 24).padStart(2, "0")}:${read("minute")}`;
}

/** Cairo wall-clock parts of a given instant. */
function cairoParts(at: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(at);
  const read = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: read("year"), month: read("month"), day: read("day") };
}

/**
 * Cairo's UTC offset in minutes at a given instant (+120 in winter, +180 in
 * summer if DST is in effect). Derived from the formatter rather than
 * hard-coded so the helper stays correct whenever Egypt changes its DST rules.
 */
function cairoOffsetMinutes(at: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(at);
  const read = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour") % 24,
    read("minute"),
    read("second"),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The UTC instant matching a Cairo wall-clock midnight of the given date. */
function cairoMidnightUtc(year: number, month: number, day: number): Date {
  const naive = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  // First pass with the offset in effect near that date, then re-check once in
  // case the guess landed on the other side of a DST switch.
  const firstGuess = new Date(naive - cairoOffsetMinutes(new Date(naive)) * 60_000);
  return new Date(naive - cairoOffsetMinutes(firstGuess) * 60_000);
}

/** Start of the Cairo calendar month containing `at` (defaults to now). */
export function startOfMonth(at: Date = new Date()): Date {
  const { year, month } = cairoParts(at);
  return cairoMidnightUtc(year, month, 1);
}

/** Start of the Cairo calendar month AFTER the one containing `at`. */
export function startOfNextMonth(at: Date = new Date()): Date {
  const { year, month } = cairoParts(at);
  return month === 12
    ? cairoMidnightUtc(year + 1, 1, 1)
    : cairoMidnightUtc(year, month + 1, 1);
}

/** Start of the Cairo calendar day containing `at` (defaults to now). */
export function startOfDay(at: Date = new Date()): Date {
  const { year, month, day } = cairoParts(at);
  return cairoMidnightUtc(year, month, day);
}

/**
 * Parses a user-supplied date filter ("2026-09-01" or a full ISO string).
 * A bare yyyy-mm-dd is read as Cairo midnight, so a range the teacher picks in
 * the UI covers exactly the days they chose.
 *
 * `endOfDay` pushes a bare date to the START of the next day, giving callers an
 * exclusive upper bound that still includes everything that happened that day.
 */
export function parseDateFilter(
  raw: string | undefined,
  { endOfDay = false }: { endOfDay?: boolean } = {},
): Date | null {
  if (!raw) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const start = cairoMidnightUtc(Number(y), Number(m), Number(d));
    if (!endOfDay) return start;
    return new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
