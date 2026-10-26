import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface PanelProps {
  title: string;
  /** One line under the title: what this box is for. */
  hint?: string;
  optional?: boolean;
  /** Next to the title (a status chip, a small action). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** One box of an admin page: a title, what it's for, and its content. */
export function Panel({ title, hint, optional, aside, children, className, id }: PanelProps) {
  return (
    <section
      id={id}
      className={cn("rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6", className)}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-foreground">
            {title}
            {optional && (
              <span className="ms-2 text-[11px] font-bold text-muted-foreground">(اختياري)</span>
            )}
          </h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
