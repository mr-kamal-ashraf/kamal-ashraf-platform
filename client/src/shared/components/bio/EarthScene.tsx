import { useId, type CSSProperties } from "react";
import { cn } from "@/shared/lib/cn";
import { BioIcon, type BioIconName } from "./BioIcon";

/*
 * A cartoon Earth with a wedge cut out to show its layers — crust, mantle,
 * outer and glowing inner core — a little mountain and tree on top, clouds
 * drifting by, and biology / geology icons riding an orbit around it.
 *
 * The planet keeps its natural colours (blue ocean, green land, a hot core)
 * so it reads as the Earth at a glance; the orbit, glow and labels follow
 * the palette. Motion is all CSS transforms on their own layers — the land
 * strip sliding under a round clip (the planet turning), the orbit, the
 * clouds, a few sparkles — so nothing repaints the drawings; only the small
 * core glow is an SVG animation.
 */

const OCEAN = "oklch(0.74 0.11 228)";
const OCEAN_DEEP = "oklch(0.56 0.13 248)";
const LAND = "oklch(0.7 0.14 140)";
const LAND_DARK = "oklch(0.5 0.11 148)";
const INK = "oklch(0.32 0.05 250)";
const CRUST = "oklch(0.58 0.07 60)";
const MANTLE = "oklch(0.68 0.17 42)";
const MANTLE_DEEP = "oklch(0.6 0.19 32)";
const OUTER_CORE = "oklch(0.8 0.15 72)";
const INNER_CORE = "oklch(0.95 0.08 95)";

/** The cut-away wedge: from just right of the top round to the right side. */
const R = 98;
const point = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180;
  return `${Math.round((100 + r * Math.cos(a)) * 10) / 10} ${Math.round((100 + r * Math.sin(a)) * 10) / 10}`;
};
const WEDGE = `M100 100 L${point(-82)} A${R} ${R} 0 0 1 ${point(-8)} Z`;

/** One tile of land (repeated twice in the sliding strip, so the loop is seamless). */
const CONTINENTS = [
  "M22 62 C30 44 54 40 66 50 C78 58 74 74 84 82 C92 90 80 104 66 100 C54 96 46 108 34 102 C22 96 26 82 18 76 C12 70 16 66 22 62Z",
  "M118 92 C128 82 148 84 158 96 C168 106 162 120 170 130 C176 140 164 152 150 146 C138 140 132 150 122 142 C112 134 120 122 112 112 C106 104 110 98 118 92Z",
  "M84 150 C92 144 104 146 106 154 C108 162 98 168 90 166 C82 164 78 156 84 150Z",
  "M150 36 C158 30 172 32 176 40 C180 48 170 54 162 52 C154 50 146 44 150 36Z",
];

function LandTile({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      {CONTINENTS.map((d, i) => (
        <path key={i} d={d} fill={LAND} stroke={LAND_DARK} strokeWidth={1.6} strokeLinejoin="round" />
      ))}
      {/* lighter patches */}
      <g fill="white" fillOpacity={0.22}>
        <ellipse cx={46} cy={64} rx={9} ry={5} />
        <ellipse cx={138} cy={102} rx={8} ry={4.5} />
      </g>
    </g>
  );
}

function Cloud({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 20" className={cn("absolute earth-cloud", className)} style={style}>
      <g fill="white" stroke={INK} strokeOpacity={0.18} strokeWidth={0.8}>
        <circle cx={12} cy={11} r={6} />
        <circle cx={21} cy={8} r={7.5} />
        <circle cx={30} cy={11.5} r={5.5} />
        <rect x={8} y={11} width={26} height={6.5} rx={3.25} />
      </g>
    </svg>
  );
}

function Sparkle({ className, delay }: { className: string; delay: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn("absolute earth-twinkle text-highlight", className)}
      style={{ animationDelay: `${-delay}s` }}
    >
      <path d="M10 1 C11 7 13 9 19 10 C13 11 11 13 10 19 C9 13 7 11 1 10 C7 9 9 7 10 1Z" fill="currentColor" />
    </svg>
  );
}

const ORBIT: Array<{ icon: BioIconName; at: string; tone: string }> = [
  { icon: "leaf", at: "left-1/2 top-0", tone: "text-primary" },
  { icon: "crystal", at: "left-full top-1/2", tone: "text-highlight" },
  { icon: "dna", at: "left-1/2 top-full", tone: "text-primary" },
  { icon: "ammonite", at: "left-0 top-1/2", tone: "text-highlight" },
];

/**
 * The Earth with its layers, an orbit of icons and two floating labels.
 * Used on the login / register brand panel.
 */
export function EarthScene({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const ocean = `${uid}-ocean`;
  const shade = `${uid}-shade`;
  const wedge = `${uid}-wedge`;
  const mantle = `${uid}-mantle`;
  const coreGlow = `${uid}-core`;

  return (
    <div className={cn("relative aspect-square w-full max-w-[26rem]", className)} aria-hidden>
      {/* soft glow behind the planet */}
      <div
        className="absolute inset-[12%] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 26%, transparent), color-mix(in oklab, var(--highlight) 10%, transparent) 55%, transparent 72%)",
        }}
      />

      {/* the orbit: a dashed ring with icons riding it, kept upright */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full animate-spin-slow text-primary/35">
        <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" />
        <circle cx="100" cy="100" r="97" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="14 7" />
      </svg>
      <div className="absolute inset-[6%] animate-spin-slow">
        {ORBIT.map(({ icon, at, tone }) => (
          <span key={icon} className={cn("absolute size-[13%] -translate-x-1/2 -translate-y-1/2", at)}>
            <span
              className={cn(
                "flex size-full animate-spin-slow items-center justify-center rounded-full border border-border bg-card shadow-elegant [animation-direction:reverse]",
                tone,
              )}
            >
              <BioIcon name={icon} className="size-[55%]" />
            </span>
          </span>
        ))}
      </div>

      {/* the planet, with a faint atmosphere around it */}
      <div className="absolute inset-[17.5%] rounded-full" style={{ boxShadow: `0 0 0 4px color-mix(in oklab, ${OCEAN} 22%, transparent), 0 0 26px color-mix(in oklab, ${OCEAN} 35%, transparent)` }} />
      <div className="absolute inset-[19%]">
        {/* ocean */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
          <defs>
            <radialGradient id={ocean} cx="40%" cy="35%">
              <stop offset="0%" style={{ stopColor: OCEAN }} />
              <stop offset="100%" style={{ stopColor: OCEAN_DEEP }} />
            </radialGradient>
          </defs>
          <circle cx={100} cy={100} r={R} fill={`url(#${ocean})`} />
        </svg>

        {/* land, sliding under a round clip: the planet turning */}
        <div className="absolute inset-[1%] overflow-hidden rounded-full" dir="ltr">
          <div className="earth-spin flex h-full w-[200%]">
            <svg viewBox="0 0 400 200" className="h-full w-full" preserveAspectRatio="none">
              <LandTile x={0} />
              <LandTile x={200} />
            </svg>
          </div>
        </div>

        {/* shading, outline, the cut-away layers, mountain and tree */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 size-full overflow-visible">
          <defs>
            <radialGradient id={shade} cx="34%" cy="28%">
              <stop offset="0%" stopColor="white" stopOpacity={0.4} />
              <stop offset="45%" stopColor="white" stopOpacity={0} />
              <stop offset="100%" stopColor="black" stopOpacity={0.28} />
            </radialGradient>
            <radialGradient id={mantle}>
              <stop offset="55%" style={{ stopColor: MANTLE }} />
              <stop offset="100%" style={{ stopColor: MANTLE_DEEP }} />
            </radialGradient>
            <clipPath id={wedge}>
              <path d={WEDGE} />
            </clipPath>
          </defs>
          <circle cx={100} cy={100} r={R} fill={`url(#${shade})`} />

          {/* the wedge: crust, mantle, outer core, inner core */}
          <g clipPath={`url(#${wedge})`} stroke={INK} strokeWidth={1.2}>
            <circle cx={100} cy={100} r={R} fill={CRUST} />
            <circle cx={100} cy={100} r={89} fill={`url(#${mantle})`} />
            <circle cx={100} cy={100} r={56} fill={OUTER_CORE} />
            <circle cx={100} cy={100} r={30} fill={INNER_CORE} />
            {/* specks of rock in the mantle */}
            <g fill={MANTLE_DEEP} stroke="none" fillOpacity={0.6}>
              <circle cx={138} cy={48} r={2} />
              <circle cx={160} cy={74} r={1.6} />
              <circle cx={126} cy={30} r={1.4} />
            </g>
          </g>
          <path d={WEDGE} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />

          <circle cx={100} cy={100} r={R} fill="none" stroke={INK} strokeWidth={2} />

          {/* a mountain with snow and a tree, standing on the surface */}
          <g transform={`translate(${point(-122)}) rotate(-32) scale(1.3)`} stroke={INK} strokeWidth={1.3} strokeLinejoin="round">
            <path d="M-16 4 L-3 -20 L10 4Z" fill="oklch(0.62 0.04 60)" />
            <path d="M-8.5 -10 L-3 -20 L2.5 -10 L0 -11.5 L-3 -9 L-6 -11.5Z" fill="white" />
            <rect x={12} y={-8} width={3} height={12} rx={1} fill="oklch(0.45 0.06 55)" />
            <circle cx={13.5} cy={-12} r={6.5} fill={LAND} stroke={LAND_DARK} />
            <circle cx={12} cy={-14} r={2} fill="white" fillOpacity={0.35} stroke="none" />
          </g>
        </svg>

        {/* the inner core's glow — it pulses as a whole drawing (scaling about
            the centre keeps the wedge in place), which the GPU can do alone */}
        <svg viewBox="0 0 200 200" className="earth-core absolute inset-0 size-full">
          <defs>
            <radialGradient id={coreGlow}>
              <stop offset="0%" stopColor="white" stopOpacity={0.9} />
              <stop offset="100%" style={{ stopColor: INNER_CORE }} stopOpacity={0} />
            </radialGradient>
          </defs>
          <g clipPath={`url(#${wedge})`}>
            <circle cx={100} cy={100} r={34} fill={`url(#${coreGlow})`} />
          </g>
        </svg>

        {/* clouds drifting across */}
        <Cloud className="-left-[6%] top-[52%] w-[34%]" />
        <Cloud className="bottom-[6%] left-[38%] w-[28%]" style={{ animationDelay: "-4s" }} />
      </div>

      <Sparkle className="left-[8%] top-[36%] size-[5%]" delay={0} />
      <Sparkle className="right-[10%] top-[64%] size-[4%]" delay={1.2} />
      <Sparkle className="bottom-[6%] right-[26%] size-[4.5%]" delay={2.1} />
      <Sparkle className="left-[30%] top-[4%] size-[3.5%]" delay={0.7} />

      {/* floating labels */}
      <div className="absolute -right-2 top-[12%] z-10 flex animate-float items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-elegant">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <BioIcon name="strata" className="size-4" />
        </span>
        <span className="text-[11px] font-extrabold text-foreground">طبقات الأرض</span>
      </div>
      <div
        className="absolute -left-2 bottom-[14%] z-10 flex animate-float items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-elegant"
        style={{ animationDelay: "-3s" }}
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-highlight/12 text-highlight">
          <BioIcon name="crystal" className="size-4" />
        </span>
        <span className="text-[11px] font-extrabold text-foreground">رحلتك بتبدأ من هنا</span>
      </div>
    </div>
  );
}
