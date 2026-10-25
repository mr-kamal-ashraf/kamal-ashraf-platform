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
  /** Don't drift — for specimens behind content further down the page, where
   *  a moving layer under the content makes the browser split everything on
   *  top of it into extra layers (slow on weak devices). */
  still?: boolean;
}

/**
 * A faint specimen (DNA, cell, leaf, crystal…) drifting slowly as if
 * suspended in fluid (or resting, when `still`). Pure CSS animation — safe in
 * server components.
 */
export function FloatingSpecimen({
  name,
  className,
  delay = 0,
  duration = 16,
  strokeWidth,
  still = false,
}: FloatingSpecimenProps) {
  const style: CSSProperties | undefined = still
    ? undefined
    : { animationDelay: `${-delay}s`, animationDuration: `${duration}s` };
  return (
    <span
      className={cn(
        "pointer-events-none absolute select-none",
        !still && "animate-drift",
        className,
      )}
      style={style}
      aria-hidden
    >
      <BioIcon name={name} className="size-full" strokeWidth={strokeWidth} />
    </span>
  );
}
