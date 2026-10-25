"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { toArabicDigits } from "@/shared/lib/arabic";
import { useRevealOnce } from "@/shared/hooks/useRevealOnce";

interface StatCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  /** Seconds the count-up takes. */
  duration?: number;
  className?: string;
  /** Classes for the prefix/suffix (e.g. to tint the "+"). */
  affixClassName?: string;
}

const digits = (n: number) =>
  toArabicDigits(n.toLocaleString("en-US").replace(/,/g, "٬"));

/**
 * Counts up from 0 to `value` (in Arabic-Indic digits) the first time it
 * scrolls into view. The final number is laid out invisibly to reserve the
 * width, and the moving digits sit on top of it — so nothing around the
 * counter jiggles while it runs. The digits are written straight into the
 * page each frame (no React re-render per frame). Screen readers get the
 * final value only.
 */
export function StatCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 1.8,
  className,
  affixClassName,
}: StatCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const counting = useRef<HTMLSpanElement>(null);
  const inView = useRevealOnce(ref, "-40px");

  useEffect(() => {
    const el = counting.current;
    if (!inView || !el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.textContent = digits(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = digits(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration]);

  const render = (count: ReactNode) => (
    <>
      {prefix && <span className={affixClassName}>{prefix}</span>}
      {count}
      {suffix && <span className={affixClassName}>{suffix}</span>}
    </>
  );

  return (
    <span ref={ref} className={className}>
      <span aria-hidden className="relative inline-block">
        <span className="invisible">{render(digits(value))}</span>
        <span className="absolute inset-0 text-center">
          {render(<span ref={counting}>{digits(0)}</span>)}
        </span>
      </span>
      <span className="sr-only">{`${prefix}${digits(value)}${suffix}`}</span>
    </span>
  );
}
