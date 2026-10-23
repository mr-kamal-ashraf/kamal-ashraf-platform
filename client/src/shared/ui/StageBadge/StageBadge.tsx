import { cn } from "@/shared/lib/cn";
import { STAGES, isStage, type Stage } from "@/shared/lib/stage";
import { MiniCell } from "@/shared/components/bio/MiniCell";

interface StageBadgeProps {
  stage: Stage;
  className?: string;
}

export function StageBadge({ stage, className }: StageBadgeProps) {
  // Data saved before the stage list changed can carry a value we no longer
  // know — show nothing rather than crash the whole page.
  if (!isStage(stage)) return null;
  const info = STAGES[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        "border",
        className,
      )}
      // Opaque chip (tinted card color) so it stays readable over cover images
      // without a costly backdrop blur.
      style={{
        backgroundColor: `color-mix(in oklab, var(${info.colorVar}) 12%, var(--card))`,
        borderColor: `color-mix(in oklab, var(${info.colorVar}) 30%, var(--card))`,
        color: `color-mix(in oklab, var(${info.colorVar}) 88%, var(--foreground))`,
      }}
    >
      <MiniCell animated={false} className="size-4" />
      {info.label}
    </span>
  );
}
