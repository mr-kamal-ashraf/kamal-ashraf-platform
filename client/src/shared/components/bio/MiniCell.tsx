import { cn } from "@/shared/lib/cn";

/**
 * A small textbook-style cell in `currentColor`: an organic membrane, an
 * off-centre nucleus with its nucleolus, a mitochondrion and a few ribosomes.
 * When animated the whole cell sways gently. The sway is on the <svg> itself
 * (a plain box the GPU can move) rather than on shapes inside it, which would
 * repaint the drawing every frame.
 */
export function MiniCell({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn(
        "size-5 shrink-0 overflow-visible",
        animated && "cell-sway",
        className,
      )}
    >
      {/* membrane + cytoplasm */}
      <path
        d="M12.6 3.1c4.7.3 8.4 3.8 8.2 8.6-.2 5-4.1 9.2-9.1 9.1-4.8-.1-8.5-3.9-8.4-8.7.1-5.2 4.1-9.3 9.3-9Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* nucleus + nucleolus */}
      <g>
        <circle
          cx="10.4"
          cy="11.2"
          r="3.6"
          fill="currentColor"
          fillOpacity="0.32"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <circle cx="11.3" cy="10.5" r="1.3" fill="currentColor" />
      </g>
      {/* mitochondrion */}
      <g transform="rotate(-32 16.3 15.6)">
        <ellipse
          cx="16.3"
          cy="15.6"
          rx="2.7"
          ry="1.45"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
        />
        <path
          d="M14.3 15.6c.5-.8.9.8 1.3 0s.9.8 1.3 0 .9.8 1.3 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </g>
      {/* ribosomes */}
      <circle cx="15.8" cy="8" r="0.85" fill="currentColor" opacity="0.75" />
      <circle cx="7.3" cy="16" r="0.8" fill="currentColor" opacity="0.75" />
      <circle cx="12.4" cy="17.4" r="0.6" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
