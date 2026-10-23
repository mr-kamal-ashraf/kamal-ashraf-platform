"use client";

import { cn } from "@/shared/lib/cn";
import { useSiteSettings } from "@/shared/site-settings";
import { BioIcon, StatCounter, type BioIconName } from "@/shared/components/bio";

/** Icon for each stat position (students · experience · stages). */
const STAT_ICONS: BioIconName[] = ["users", "award", "layers"];

const COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

/**
 * The hero's headline numbers as one quiet strip: columns split by hairlines,
 * a large count-up figure each, and a small icon + label below. Numbers,
 * labels and which ones show are edited from the admin panel.
 */
export function HeroStats({ className }: { className?: string }) {
  const stats = useSiteSettings()
    .hero.stats.map((stat, i) => ({ ...stat, icon: STAT_ICONS[i] ?? "spark" }))
    .filter((stat) => stat.visible);

  if (stats.length === 0) return null;

  return (
    <dl
      className={cn(
        "grid rounded-2xl border border-border bg-card/85 py-4 shadow-soft sm:py-5",
        COLS[stats.length] ?? "grid-cols-3",
        className,
      )}
    >
      {stats.map((stat, i) => (
        <div
          key={`${stat.label}-${i}`}
          className={cn(
            "flex flex-col items-center gap-1.5 px-2 text-center",
            i > 0 && "border-s border-border",
          )}
        >
          <dd className="text-2xl font-black leading-none tracking-tight text-foreground tabular-nums sm:text-[calc(1.85rem*var(--font-scale,1))]">
            <StatCounter
              value={stat.value}
              prefix={stat.prefix}
              suffix={stat.suffix}
              affixClassName="text-primary"
            />
          </dd>
          <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground sm:text-xs">
            <BioIcon name={stat.icon as BioIconName} className="size-3.5 text-primary/70" />
            {stat.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
