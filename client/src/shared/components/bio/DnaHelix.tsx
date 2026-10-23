"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";

interface DnaHelixProps {
  /** Number of base pairs drawn top → bottom. */
  rungs?: number;
  /** Seconds for one full turn of the helix. */
  duration?: number;
  /** How many rungs make one full twist. */
  rungsPerTurn?: number;
  className?: string;
}

/**
 * A slowly rotating DNA double helix, animated in CSS.
 *
 * Each base pair is a bar + two nucleotides. The nucleotides orbit on the
 * `dna-dot` keyframes (sideways + depth scale/fade), the bar stretches with
 * `dna-bar`; staggering the phase per rung produces the twist. Colors come
 * from the theme (brand + highlight), so it follows the palette.
 *
 * Animating SVG children repaints the SVG every frame, so the helix pauses
 * itself whenever it is scrolled out of view.
 */
export function DnaHelix({
  rungs = 14,
  duration = 6,
  rungsPerTurn = 10,
  className,
}: DnaHelixProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setPaused(!entry.isIntersecting),
      { rootMargin: "80px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const gap = 18;
  const height = rungs * gap;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 80 ${height}`}
      className={cn("overflow-visible", paused && "dna-paused", className)}
      aria-hidden
    >
      {Array.from({ length: rungs }).map((_, i) => {
        const y = gap / 2 + i * gap;
        const phase = -((i % rungsPerTurn) / rungsPerTurn) * duration;
        const timing = {
          animationDuration: `${duration}s`,
          animationDelay: `${phase}s`,
        };
        const opposite = {
          animationDuration: `${duration}s`,
          animationDelay: `${phase - duration / 2}s`,
        };
        return (
          <g key={i}>
            <line
              x1="12"
              x2="68"
              y1={y}
              y2={y}
              className="dna-bar"
              style={timing}
              stroke="currentColor"
              strokeOpacity={0.28}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle
              cx="40"
              cy={y}
              r="4.6"
              className="dna-dot"
              style={timing}
              fill="var(--brand)"
            />
            <circle
              cx="40"
              cy={y}
              r="4.6"
              className="dna-dot"
              style={opposite}
              fill="var(--highlight)"
            />
          </g>
        );
      })}
    </svg>
  );
}
