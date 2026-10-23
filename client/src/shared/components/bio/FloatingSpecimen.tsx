import type { CSSProperties } from "react";
import { cn } from "@/shared/lib/cn";
import { BioIcon, type BioIconName } from "./BioIcon";

interface FloatingSpecimenProps {
  name: BioIconName;
  /** Position, size and color classes (e.g. "left-[6%] top-[12%] size-24 text-primary/10"). */
  className?: string;
  /** Seconds of offset so neighbors don't move in lockstep. */
  delay?: number;
  /** Seconds per drift cycle. */
  duration?: number;
  strokeWidth?: number;
}

/**
 * A faint specimen (DNA, cell, leaf, crystal…) drifting slowly as if
 * suspended in fluid. Pure CSS animation — safe in server components.
 */
export function FloatingSpecimen({
  name,
  className,
  delay = 0,
  duration = 16,
  strokeWidth,
}: FloatingSpecimenProps) {
  const style: CSSProperties = {
    animationDelay: `${-delay}s`,
    animationDuration: `${duration}s`,
  };
  return (
    <span
      className={cn(
        "pointer-events-none absolute select-none animate-drift",
        className,
      )}
      style={style}
      aria-hidden
    >
      <BioIcon name={name} className="size-full" strokeWidth={strokeWidth} />
    </span>
  );
}
