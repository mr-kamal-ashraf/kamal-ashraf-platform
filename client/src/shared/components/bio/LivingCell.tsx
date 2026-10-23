import type { CSSProperties } from "react";
import { cn } from "@/shared/lib/cn";

interface LivingCellProps {
  className?: string;
  /** Theme color variable for the cell's body, e.g. "--brand". */
  tone?: "--brand" | "--highlight" | "--tertiary";
  /** Seconds of offset so neighbouring cells wobble out of phase. */
  delay?: number;
  /** Show the nucleus + organelles inside. */
  organelles?: boolean;
  style?: CSSProperties;
}

/**
 * A soft, translucent cell whose membrane slowly wobbles (CSS border-radius
 * morph). Scales to whatever box it's given; purely decorative.
 */
export function LivingCell({
  className,
  tone = "--brand",
  delay = 0,
  organelles = true,
  style,
}: LivingCellProps) {
  const color = `var(${tone})`;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute animate-membrane", className)}
      style={{
        animationDelay: `${-delay}s`,
        background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${color} 22%, transparent), color-mix(in oklab, ${color} 8%, transparent) 70%)`,
        border: `1.5px solid color-mix(in oklab, ${color} 40%, transparent)`,
        boxShadow: `inset 0 0 24px color-mix(in oklab, ${color} 18%, transparent)`,
        ...style,
      }}
    >
      {organelles && (
        <>
          <span
            className="absolute left-[38%] top-[34%] size-[30%] rounded-full"
            style={{
              background: `radial-gradient(circle at 40% 35%, color-mix(in oklab, ${color} 55%, transparent), color-mix(in oklab, ${color} 25%, transparent))`,
              border: `1px solid color-mix(in oklab, ${color} 55%, transparent)`,
            }}
          >
            <span
              className="absolute left-[45%] top-[30%] size-[30%] rounded-full"
              style={{ background: color, opacity: 0.7 }}
            />
          </span>
          <span
            className="absolute left-[18%] top-[62%] size-[7%] rounded-full"
            style={{ background: color, opacity: 0.45 }}
          />
          <span
            className="absolute left-[70%] top-[24%] size-[6%] rounded-full"
            style={{ background: color, opacity: 0.4 }}
          />
          <span
            className="absolute left-[64%] top-[66%] h-[9%] w-[18%] rounded-full"
            style={{
              border: `1px solid color-mix(in oklab, ${color} 60%, transparent)`,
              transform: "rotate(-28deg)",
            }}
          />
        </>
      )}
    </div>
  );
}
