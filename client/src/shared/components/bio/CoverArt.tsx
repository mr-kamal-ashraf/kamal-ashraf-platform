import { cn } from "@/shared/lib/cn";
import { BioIcon, pickSpecimen } from "./BioIcon";
import { CellPattern } from "./CellPattern";

interface CoverArtProps {
  /** Slug/id — picks a stable specimen so each course keeps its own art. */
  seed: string;
  /** Size class for the specimen glyph. */
  glyphClassName?: string;
  className?: string;
}

/**
 * Default cover for a course/lesson that has no uploaded thumbnail. Sits on
 * top of the stage gradient: tissue pattern + a large specimen glyph + a soft
 * sheen. Reacts to a parent `group` hover.
 */
export function CoverArt({
  seed,
  glyphClassName = "size-32 sm:size-36",
  className,
}: CoverArtProps) {
  return (
    <div className={cn("absolute inset-0", className)} aria-hidden>
      <CellPattern className="text-white/10" fade={false} scale={0.7} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, oklch(1 0 0 / 0.16), transparent 60%)",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <BioIcon
          name={pickSpecimen(seed)}
          strokeWidth={1.8}
          className={cn(
            "text-white/30 drop-shadow-lg transition-transform duration-700 group-hover:rotate-6 group-hover:scale-110",
            glyphClassName,
          )}
        />
      </div>
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(135deg, transparent 30%, oklch(1 0 0 / 0.16) 50%, transparent 70%)",
        }}
      />
    </div>
  );
}
