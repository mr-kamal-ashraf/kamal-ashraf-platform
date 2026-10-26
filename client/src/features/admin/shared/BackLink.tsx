import Link from "next/link";
import type { ReactNode } from "react";

/** "→ الكورسات": the way back to the page this one belongs to. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[32px] items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary"
    >
      <svg aria-hidden className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 18 6-6-6-6" />
      </svg>
      {children}
    </Link>
  );
}
