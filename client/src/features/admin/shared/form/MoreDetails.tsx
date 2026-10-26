import type { ReactNode } from "react";

interface MoreDetailsProps {
  title: string;
  /** What's inside, so it's clear without opening it. */
  hint?: string;
  children: ReactNode;
}

/**
 * The optional part of a form, folded away so the page shows only what's
 * needed. Native <details>: works without script, and a field in red inside
 * opens it (focusFirstInvalid).
 */
export function MoreDetails({ title, hint, children }: MoreDetailsProps) {
  return (
    <details className="group rounded-2xl border border-border bg-card shadow-soft">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-4 hover:bg-muted/40 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="text-base font-extrabold text-foreground">{title}</span>
          <span className="ms-2 text-[11px] font-bold text-muted-foreground">(اختياري)</span>
          {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
        </span>
        <svg
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="space-y-4 border-t border-border/60 p-4 sm:p-6">{children}</div>
    </details>
  );
}
