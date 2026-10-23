"use client";

import { useLayoutEffect } from "react";
import { BrandLogo } from "@/shared/components/BrandLogo";
import { cn } from "@/shared/lib/cn";
import { holdPageChange } from "@/shared/navigation/navigationProgress";

interface LoadingScreenProps {
  /** The main line (and what screen readers hear). */
  label?: string;
  /** A smaller line under it (e.g. how long an upload may take). */
  hint?: string;
  /**
   * - page: covers the screen (a page change, a whole page loading)
   * - section: stands in for a list or card while its data loads
   * - overlay: covers the page during a long action the user started
   */
  variant?: "page" | "section" | "overlay";
  /** Fade in only after a moment, so a quick load never flashes it. */
  delayed?: boolean;
  /**
   * While it's on screen, a page change counts as unfinished: the full-screen
   * loader that started at the click stays up until this goes, so moving to a
   * page shows one loading screen until all of it is ready. Off for the
   * page-change loader itself and for an action's overlay.
   */
  holdsPageChange?: boolean;
  className?: string;
}

/**
 * The platform's loading state: inside a wide, thin circle, the logo, the
 * label with three bouncing dots, a hint and a sliding bar (see "LOADING
 * STATE" in styles.css). CSS only — no timers, no extra script — and the logo
 * is the same file the header already loaded.
 */
export function LoadingScreen({
  label = "جاري التحميل",
  hint,
  variant = "section",
  delayed = false,
  holdsPageChange = variant !== "overlay",
  className,
}: LoadingScreenProps) {
  // Before the URL-change effect runs, so the hand-over has no gap.
  useLayoutEffect(() => (holdsPageChange ? holdPageChange() : undefined), [holdsPageChange]);

  const big = variant !== "section";
  // The dots are drawn (and animated) here, so drop any typed in the label.
  const text = label.replace(/[.…\s]+$/u, "");

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center px-4",
        variant === "page" && "brand-loader--page fixed inset-0 z-150",
        variant === "overlay" && "brand-loader--page fixed inset-0 z-200",
        variant === "section" && "rounded-2xl border border-border bg-card py-8",
        delayed && "brand-loader--delayed",
        className,
      )}
    >
      <div className="brand-loader__ring" data-size={big ? undefined : "sm"}>
        <div aria-hidden className="brand-loader__logo">
          <BrandLogo className={big ? "h-14 sm:h-16" : "h-9"} />
        </div>
        <p
          className={cn(
            // In the chosen palette's color (the dots follow it).
            "font-extrabold text-primary",
            big ? "mt-4 text-xl sm:text-2xl" : "mt-2 text-base",
          )}
        >
          {text}
          <span aria-hidden className="brand-loader__dots">
            <i />
            <i />
            <i />
          </span>
        </p>
        {hint && (
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{hint}</p>
        )}
        <div aria-hidden className="brand-loader__bar">
          <span />
        </div>
      </div>
    </div>
  );
}
