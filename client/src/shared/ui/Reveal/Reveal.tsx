"use client";

import { useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { useRevealOnce } from "@/shared/hooks/useRevealOnce";

interface RevealProps {
  as?: "div" | "article" | "section" | "li";
  /** Seconds to wait once in view — staggers siblings. */
  delay?: number;
  /** How far below its place it starts, in px. */
  rise?: number;
  /** How far to the side it starts, in px (positive = from the right). */
  shift?: number;
  /** The viewport edge it must cross (IntersectionObserver rootMargin). */
  margin?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Fades and lifts its content in the first time it scrolls into view, then
 * stays. The motion is `.reveal` in styles.css — opacity + transform only, so
 * the GPU runs it, and nothing listens to scrolling. With reduced motion it's
 * simply there.
 */
export function Reveal({
  as = "div",
  delay = 0,
  rise = 24,
  shift = 0,
  margin = "0px 0px -60px 0px",
  className,
  children,
}: RevealProps) {
  const Tag = as as ElementType;
  const ref = useRef<HTMLElement>(null);
  const shown = useRevealOnce(ref, margin);
  return (
    <Tag
      ref={ref}
      data-shown={shown || undefined}
      className={cn("reveal", className)}
      style={
        {
          "--reveal-x": `${shift}px`,
          "--reveal-y": `${rise}px`,
          "--reveal-delay": `${delay}s`,
        } as CSSProperties
      }
    >
      {children}
    </Tag>
  );
}
