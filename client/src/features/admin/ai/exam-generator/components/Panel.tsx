import type { ReactNode } from "react";

/**
 * One quadrant of the exam-generator board: a fixed-height card with a header,
 * a scrollable body, and an optional pinned footer. The fixed height + internal
 * scroll are what keep the board a tidy 2×2 instead of one endlessly tall page.
 *
 * On print the height/scroll caps are lifted (print:* classes passed in) so a
 * previewed paper is never clipped to the panel's on-screen height.
 */
export function Panel({
  title,
  count,
  actions,
  footer,
  children,
  className,
  headerClassName,
  bodyClassName,
}: {
  title: string;
  count?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft lg:h-[clamp(430px,54vh,580px)] ${
        className ?? ""
      }`}
    >
      <div
        className={`flex shrink-0 items-center gap-2 border-b border-border/70 px-4 py-3 sm:px-5 ${
          headerClassName ?? ""
        }`}
      >
        <h2 className="text-sm font-extrabold text-foreground">{title}</h2>
        {count != null ? (
          <span className="rounded-lg bg-muted/60 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
            {count}
          </span>
        ) : null}
        {actions ? (
          <div className="ms-auto flex items-center gap-1.5">{actions}</div>
        ) : null}
      </div>

      <div
        className={`nice-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 ${
          bodyClassName ?? ""
        }`}
      >
        {children}
      </div>

      {footer ? (
        <div className="shrink-0 border-t border-border/70 px-4 py-3 sm:px-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
