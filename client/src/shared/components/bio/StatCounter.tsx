"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { toArabicDigits } from "@/shared/lib/arabic";

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

/**
 * Counts up from 0 to `value` (in Arabic-Indic digits) the first time it
 * scrolls into view. The final number is laid out invisibly to reserve the
 * width, and the moving digits sit on top of it — so nothing around the
 * counter jiggles while it runs. Screen readers get the final value only.
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
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  const digits = (n: number) =>
    toArabicDigits(n.toLocaleString("en-US").replace(/,/g, "٬"));

  const render = (n: number) => (
    <>
      {prefix && <span className={affixClassName}>{prefix}</span>}
      {digits(n)}
      {suffix && <span className={affixClassName}>{suffix}</span>}
    </>
  );

  return (
    <span ref={ref} className={className}>
      <span aria-hidden className="relative inline-block">
        <span className="invisible">{render(value)}</span>
        <span className="absolute inset-0 text-center">{render(display)}</span>
      </span>
      <span className="sr-only">{`${prefix}${digits(value)}${suffix}`}</span>
    </span>
  );
}
