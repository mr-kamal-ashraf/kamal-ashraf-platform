import { cn } from "@/shared/lib/cn";
import { BioIcon, type BioIconName } from "./BioIcon";

/** Ornamental divider: fading hairline · small specimen · fading hairline. */
export function BioDivider({
  icon = "dna",
  className,
  tone = "highlight",
}: {
  icon?: BioIconName;
  className?: string;
  tone?: "primary" | "highlight";
}) {
  const line =
    tone === "primary"
      ? "via-primary/45"
      : "via-highlight/50";
  return (
    <div
      className={cn("flex items-center justify-center gap-3", className)}
      aria-hidden
    >
      <span className={cn("h-px w-16 bg-linear-to-r from-transparent to-transparent", line)} />
      <BioIcon
        name={icon}
        className={cn(
          "size-5",
          tone === "primary" ? "text-primary" : "text-highlight",
        )}
      />
      <span className={cn("h-px w-16 bg-linear-to-r from-transparent to-transparent", line)} />
    </div>
  );
}
