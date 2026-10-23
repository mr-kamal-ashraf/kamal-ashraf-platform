import { useId } from "react";
import { cn } from "@/shared/lib/cn";

interface CellPatternProps {
  className?: string;
  /** Fade the pattern out toward the edges with a radial mask. */
  fade?: boolean;
  /** Tile scale — 1 is a ~42px honeycomb cell. */
  scale?: number;
}

/**
 * Plant-tissue / honeycomb cell pattern (each cell with a nucleus), drawn in
 * `currentColor`. Used as a faint texture behind sections — the biology
 * replacement for the old arabesque pattern.
 */
export function CellPattern({ className, fade = true, scale = 1 }: CellPatternProps) {
  const id = useId().replace(/:/g, "");
  const w = 41.57 * scale;
  const h = 72 * scale;

  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      style={
        fade
          ? {
              maskImage:
                "radial-gradient(ellipse 70% 65% at 50% 45%, black 25%, transparent 80%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 70% 65% at 50% 45%, black 25%, transparent 80%)",
            }
          : undefined
      }
      aria-hidden
    >
      <defs>
        <pattern
          id={`cells-${id}`}
          width={w}
          height={h}
          patternUnits="userSpaceOnUse"
        >
          <g transform={`scale(${scale})`}>
            <path
              d="M20.78 0 L41.57 12 L41.57 36 L20.78 48 L0 36 L0 12 Z M20.78 48 V72"
              fill="none"
              stroke="currentColor"
              strokeWidth={0.9 / scale}
            />
            <circle cx="20.78" cy="24" r="3.4" fill="currentColor" />
            <circle cx="0" cy="60" r="3.4" fill="currentColor" />
            <circle cx="41.57" cy="60" r="3.4" fill="currentColor" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#cells-${id})`} />
    </svg>
  );
}
