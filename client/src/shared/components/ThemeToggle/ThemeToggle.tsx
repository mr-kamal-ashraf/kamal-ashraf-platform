"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { themeStorageKey } from "@/shared/lib/themeMode";

type Theme = "light" | "dark";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(next: Theme) {
  try {
    // The admin panel's choice is kept apart from the site's.
    window.localStorage.setItem(themeStorageKey(window.location.pathname), next);
  } catch {
    // ignore
  }
  document.documentElement.classList.toggle("dark", next === "dark");
}

/**
 * Light / dark switch.
 *  - "icon" (default, site header): a switch whose knob carries a sprout in
 *    daylight (photosynthesis) and a glowing mushroom at night (bioluminescence).
 *  - "label": full-width text button used in the admin sidebar.
 */
export function ThemeToggle({
  variant = "icon",
}: {
  variant?: "icon" | "label";
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  const isDark = theme === "dark";
  const toggle = () => {
    const next: Theme = isDark ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  if (variant === "label") {
    const label = isDark ? "الوضع الفاتح" : "الوضع الداكن";
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
        <span>{label}</span>
      </button>
    );
  }

  const label = isDark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={label}
      title={label}
      onClick={toggle}
      dir="ltr"
      className={cn(
        "group relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border p-1",
        "border-border bg-primary/8 transition-colors hover:border-primary/40 dark:bg-primary/15",
      )}
    >
      {/* track hints: a small sun on the day side, stars on the night side */}
      <span
        aria-hidden
        className={cn(
          "absolute left-2.5 text-highlight transition-opacity duration-300",
          isDark ? "opacity-70" : "opacity-0",
        )}
      >
        <TinySun />
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute right-2 text-primary transition-opacity duration-300",
          isDark ? "opacity-0" : "opacity-60",
        )}
      >
        <TinyStars />
      </span>

      {/* knob */}
      <span
        className={cn(
          "relative z-10 flex size-7 items-center justify-center rounded-full bg-card shadow-soft",
          mounted && "transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
          isDark ? "translate-x-6.5" : "translate-x-0",
        )}
      >
        {isDark ? <GlowMushroom /> : <Sprout />}
      </span>
    </button>
  );
}

function Sprout() {
  return (
    <svg
      className="size-4 text-primary"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21v-8" />
      <path d="M12 13c0-4-3-6.5-7-6.5 0 4 3 6.5 7 6.5Z" />
      <path d="M12 11c0-3.5 2.6-6 6.5-6 0 3.6-2.6 6-6.5 6Z" />
    </svg>
  );
}

function GlowMushroom() {
  return (
    <svg
      className="size-4 text-highlight"
      style={{ filter: "drop-shadow(0 0 3px var(--highlight))" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 12.5C3.5 7.8 7.3 4 12 4s8.5 3.8 8.5 8.5Z" fill="currentColor" fillOpacity="0.25" />
      <path d="M9.5 12.5v5.2a2.5 2.5 0 0 0 5 0v-5.2" />
      <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7.6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10.6" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TinySun() {
  return (
    <svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="5" />
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
      </g>
    </svg>
  );
}

function TinyStars() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 3l1.4 3.6L14 8l-3.6 1.4L9 13l-1.4-3.6L4 8l3.6-1.4Z" />
      <path d="M17 13l.9 2.1L20 16l-2.1.9L17 19l-.9-2.1L14 16l2.1-.9Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
