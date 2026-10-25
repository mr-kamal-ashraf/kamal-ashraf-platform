import { cn } from "@/shared/lib/cn";
import { CellPattern } from "./CellPattern";
import { FloatingSpecimen } from "./FloatingSpecimen";

/**
 * Shared biology backdrop for inner pages (courses, course details, profile,
 * player, payment): a soft top glow, a faint tissue pattern and a couple of
 * specimens. They stay still: the page's content sits on top of them, and a
 * moving layer underneath would split it into extra layers. Place inside a
 * `relative` container.
 */
export function PageBackdrop({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] overflow-clip",
        className,
      )}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 70% 0%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%), radial-gradient(ellipse 45% 55% at 10% 10%, color-mix(in oklab, var(--highlight) 9%, transparent), transparent 70%)",
        }}
      />
      <CellPattern className="text-primary/5 dark:text-primary/7" />
      <FloatingSpecimen
        name="leaf"
        className="right-[4%] top-16 hidden size-24 text-primary/9 sm:block"
        still
      />
      <FloatingSpecimen
        name="crystal"
        className="left-[5%] top-40 hidden size-20 text-highlight/10 md:block"
        still
      />
    </div>
  );
}
