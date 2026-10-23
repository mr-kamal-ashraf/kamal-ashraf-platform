/**
 * Convert a duration string (e.g. "15m", "7d", "2h", "30s") to milliseconds.
 * Accepts a plain number (treated as milliseconds) as well.
 */
export default function ms(input: string | number): number {
  if (typeof input === "number") return input;

  const match = /^(\d+)\s*(ms|s|m|h|d|w|y)$/i.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid duration string: ${input}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}
