import { cn } from "@/shared/lib/cn";

interface DnaHelixProps {
  /** Number of base pairs visible top → bottom. */
  rungs?: number;
  /** Seconds for one full turn of the helix. */
  duration?: number;
  /** How many rungs make one full twist. */
  rungsPerTurn?: number;
  className?: string;
}

const GAP = 18;
const REACH = 28;

/**
 * Two decimals. Math.cos/sin can differ in the last digit between the server
 * (Node) and the browser, and React then reports the drawing as not matching
 * the server's HTML.
 */
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A slowly turning DNA double helix that fills its box's width.
 *
 * A helix turning on its axis looks exactly like the same helix sliding along
 * it, so the strand is drawn once (one extra turn long) and slides up by one
 * turn on a loop. Moving a whole element is done by the GPU without
 * repainting — animating each nucleotide repainted the drawing every frame,
 * which is what made weak devices stutter. Colors come from the theme (brand +
 * highlight), so it follows the palette.
 */
export function DnaHelix({
  rungs = 14,
  duration = 6,
  rungsPerTurn = 10,
  className,
}: DnaHelixProps) {
  const drawn = rungs + rungsPerTurn;

  return (
    <div
      aria-hidden
      className={cn("flex items-center justify-center", className)}
    >
      <div
        className="dna-window relative w-full max-h-full overflow-hidden"
        style={{ aspectRatio: `80 / ${rungs * GAP}` }}
      >
        {/* one turn tall, so sliding it by its own height moves one turn */}
        <div
          className="dna-slide absolute inset-x-0 top-0"
          style={{
            height: `${(rungsPerTurn / rungs) * 100}%`,
            animationDuration: `${duration}s`,
          }}
        >
          <svg
            viewBox={`0 0 80 ${drawn * GAP}`}
            preserveAspectRatio="none"
            className="absolute inset-x-0 top-0 w-full overflow-visible"
            style={{ height: `${(drawn / rungsPerTurn) * 100}%` }}
          >
            {Array.from({ length: drawn }).map((_, i) => {
              const y = GAP / 2 + i * GAP;
              const angle = (2 * Math.PI * (i % rungsPerTurn)) / rungsPerTurn;
              const x = round(-REACH * Math.cos(angle));
              const depth = round(Math.sin(angle));
              return (
                <g key={i}>
                  <line
                    x1={40 + x}
                    x2={40 - x}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.28}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <Nucleotide
                    x={40 + x}
                    y={y}
                    depth={depth}
                    fill="var(--brand)"
                  />
                  <Nucleotide
                    x={40 - x}
                    y={y}
                    depth={-depth}
                    fill="var(--highlight)"
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

/** depth 1 = nearest the viewer (bigger, solid), −1 = behind (small, faint). */
function Nucleotide({
  x,
  y,
  depth,
  fill,
}: {
  x: number;
  y: number;
  depth: number;
  fill: string;
}) {
  return (
    <circle
      cx={x}
      cy={y}
      r={round(4.6 * (0.9 + 0.25 * depth))}
      fill={fill}
      opacity={round(0.725 + 0.275 * depth)}
    />
  );
}
