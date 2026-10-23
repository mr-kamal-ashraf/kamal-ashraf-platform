import { cn } from "@/shared/lib/cn";

/**
 * Fixed positions (not random) so server and client render identically.
 * left %, bottom %, size px, delay s, duration s, tone
 */
const SPORES: Array<[number, number, number, number, number, 0 | 1 | 2]> = [
  [6, 4, 6, 0, 9, 0],
  [14, 18, 4, 3.5, 11, 1],
  [23, 2, 5, 6, 10, 2],
  [34, 12, 3, 1.5, 12, 0],
  [46, 6, 6, 4.5, 9.5, 1],
  [57, 16, 4, 7, 11.5, 2],
  [66, 3, 5, 2.5, 10.5, 0],
  [77, 14, 3, 5.5, 12.5, 1],
  [86, 5, 6, 1, 9, 2],
  [94, 20, 4, 3, 11, 0],
];

const TONES = ["var(--brand)", "var(--highlight)", "var(--tertiary)"];

/** Tiny glowing particles rising slowly, like spores or bubbles in a culture. */
export function Spores({
  className,
  count = SPORES.length,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      {SPORES.slice(0, count).map(([left, bottom, size, delay, duration, tone], i) => (
        <span
          key={i}
          className="absolute rounded-full animate-rise"
          style={{
            left: `${left}%`,
            bottom: `${bottom}%`,
            width: size,
            height: size,
            background: TONES[tone],
            boxShadow: `0 0 ${size * 2}px ${TONES[tone]}`,
            animationDelay: `${-delay}s`,
            animationDuration: `${duration}s`,
          }}
        />
      ))}
    </div>
  );
}
