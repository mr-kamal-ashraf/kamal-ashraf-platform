import { useId } from "react";
import { cn } from "@/shared/lib/cn";

interface DnaStrandProps {
  /** "vertical" runs top→bottom (fill a tall box), "horizontal" runs across. */
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/**
 * A static, endlessly repeating DNA double strand drawn with an SVG pattern —
 * it stretches to any length at zero animation cost. Colors follow the theme.
 */
export function DnaStrand({
  orientation = "vertical",
  className,
}: DnaStrandProps) {
  const id = useId().replace(/:/g, "");
  const vertical = orientation === "vertical";

  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none block", className)}
      width="100%"
      height="100%"
    >
      <defs>
        <pattern
          id={`strand-${id}`}
          width={vertical ? 40 : 120}
          height={vertical ? 120 : 40}
          patternUnits="userSpaceOnUse"
          x={vertical ? "50%" : 0}
          y={vertical ? 0 : "50%"}
          patternTransform={vertical ? "translate(-20 0)" : "translate(0 -20)"}
        >
          {/* the tile is drawn vertically; for horizontal it is turned on its side */}
          <g transform={vertical ? undefined : "translate(0 40) rotate(-90)"}>
            <path
              d="M10 0 C10 30 30 30 30 60 C30 90 10 90 10 120"
              fill="none"
              stroke="var(--primary)"
              strokeOpacity="0.4"
              strokeWidth="2"
            />
            <path
              d="M30 0 C30 30 10 30 10 60 C10 90 30 90 30 120"
              fill="none"
              stroke="var(--highlight)"
              strokeOpacity="0.45"
              strokeWidth="2"
            />
            <g stroke="var(--foreground)" strokeOpacity="0.14" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12.5 7 H27.5" />
              <path d="M13 50 H27" />
              <path d="M12 60 H28" />
              <path d="M13 70 H27" />
              <path d="M12.5 113 H27.5" />
            </g>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#strand-${id})`} />
    </svg>
  );
}
