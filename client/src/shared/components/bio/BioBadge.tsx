import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { MiniCell } from "./MiniCell";

interface BioBadgeProps {
  children: ReactNode;
  tone?: "primary" | "highlight";
  /** Keep the cell still (e.g. when many badges sit side by side). */
  still?: boolean;
  className?: string;
}

/**
 * Section label / eyebrow pill. Instead of a plain dot it carries a tiny cell
 * sitting in a "petri dish" that slowly divides.
 */
export function BioBadge({
  children,
  tone = "primary",
  still = false,
  className,
}: BioBadgeProps) {
  const isHighlight = tone === "highlight";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-card/80 py-1 pe-4 ps-1 text-xs font-bold sm:text-[13px]",
        isHighlight
          ? "border-highlight/25 text-highlight"
          : "border-primary/20 text-primary",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full",
          isHighlight ? "bg-highlight/10" : "bg-primary/8",
        )}
      >
        <MiniCell animated={!still} className="size-6" />
      </span>
      {children}
    </span>
  );
}
