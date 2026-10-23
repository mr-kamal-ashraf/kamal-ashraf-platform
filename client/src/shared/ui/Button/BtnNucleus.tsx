import type { ReactNode } from "react";

/** The forward arrow (points left in this RTL site). */
export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

/**
 * The icon chamber ("nucleus") of a primary button — see `.btn` in
 * styles.css. Put it first inside the button; it shows the forward arrow
 * unless you pass another icon.
 */
export function BtnNucleus({ children }: { children?: ReactNode }) {
  return (
    <span className="btn-nucleus" aria-hidden>
      {children ?? <ArrowIcon />}
    </span>
  );
}
