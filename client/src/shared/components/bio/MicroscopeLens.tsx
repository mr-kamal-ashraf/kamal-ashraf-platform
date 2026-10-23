import { cn } from "@/shared/lib/cn";
import { BioIcon } from "./BioIcon";
import { CellPattern } from "./CellPattern";
import { DnaHelix } from "./DnaHelix";
import { LivingCell } from "./LivingCell";

/**
 * "Looking through the microscope" illustration: a lens with living cells
 * drifting inside, a turning DNA strand, a measuring reticle and a slowly
 * rotating scale ring. Used on the login / register brand panel in place of
 * a photo. Pure CSS motion; every color is a theme token.
 */
export function MicroscopeLens({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative aspect-square w-full max-w-[26rem]", className)}
      aria-hidden
    >
      {/* soft glow behind the lens */}
      <div
        className="absolute inset-[6%] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 30%, transparent), transparent 70%)",
        }}
      />

      {/* rotating scale ring */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 size-full animate-spin-slow text-primary/40"
      >
        <circle
          cx="100"
          cy="100"
          r="97"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="1 5.1"
        />
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.4"
          strokeDasharray="14 6"
        />
      </svg>

      {/* lens rim */}
      <div className="absolute inset-[7%] rounded-full bg-gradient-brand p-[3.5%] shadow-brand dark:bg-brand-deep">
        <div className="relative size-full overflow-hidden rounded-full bg-card">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--tertiary) 10%, var(--card)), var(--card) 70%)",
            }}
          />
          <CellPattern className="text-primary/7" fade={false} scale={0.8} />

          <LivingCell
            className="left-[12%] top-[16%] size-[34%]"
            tone="--brand"
          />
          <LivingCell
            className="left-[54%] top-[48%] size-[30%]"
            tone="--highlight"
            delay={4}
          />
          <LivingCell
            className="left-[58%] top-[14%] size-[18%]"
            tone="--tertiary"
            delay={8}
          />
          <LivingCell
            className="left-[16%] top-[62%] size-[20%]"
            tone="--tertiary"
            delay={2}
            organelles={false}
          />

          <div className="absolute -left-[2%] top-[18%] h-[64%] w-[16%] rotate-[24deg] text-primary/60">
            <DnaHelix rungs={9} duration={7} className="size-full" />
          </div>

          {/* reticle */}
          <div className="absolute inset-x-[8%] top-1/2 h-px bg-foreground/10" />
          <div className="absolute inset-y-[8%] left-1/2 w-px bg-foreground/10" />
          <div className="absolute left-1/2 top-1/2 size-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/10" />

          {/* glass reflection */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(140deg, oklch(1 0 0 / 0.22), transparent 38%, transparent 70%, oklch(1 0 0 / 0.06))",
            }}
          />
        </div>
      </div>

      {/* floating labels */}
      <div className="absolute -right-2 top-[14%] flex animate-float items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-elegant">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <BioIcon name="microscope" className="size-4" />
        </span>
        <span className="text-[11px] font-extrabold text-foreground">
          خلية حية ×٤٠٠
        </span>
      </div>
      <div
        className="absolute -left-2 bottom-[16%] flex animate-float items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-elegant"
        style={{ animationDelay: "-3s" }}
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-highlight/12 text-highlight">
          <BioIcon name="crystal" className="size-4" />
        </span>
        <span className="text-[11px] font-extrabold text-foreground">
          رحلتك بتبدأ من هنا
        </span>
      </div>
    </div>
  );
}
