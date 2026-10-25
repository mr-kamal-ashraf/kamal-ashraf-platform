import type { CSSProperties } from "react";
import { cn } from "@/shared/lib/cn";
import { CellPattern } from "./CellPattern";
import { FloatingSpecimen } from "./FloatingSpecimen";

/*
 * Biology backdrops for home sections, so they don't sit on a flat colour.
 * Everything is static SVG / CSS gradients in the theme's colours, faint
 * enough to keep the content readable. Nothing moves: an animated layer under
 * a section's content makes the browser split all the content on top of it
 * into extra layers, which is what made weak devices stutter.
 */

/** Fades the decorations out toward the section's top and bottom edges. */
const EDGE_FADE: CSSProperties = {
  maskImage: "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
  WebkitMaskImage: "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
};

/** Keeps a pattern to the sides, clear of the content in the middle. */
const SIDES_ONLY: CSSProperties = {
  maskImage: "linear-gradient(to right, black, transparent 32%, transparent 68%, black)",
  WebkitMaskImage: "linear-gradient(to right, black, transparent 32%, transparent 68%, black)",
};

// A tall DNA double helix: two strands and their base pairs, drawn top → bottom.
const HELIX_HEIGHT = 520;
const HELIX = (() => {
  const amplitude = 22;
  const centre = 30;
  const period = 120;
  const strand = (phase: number) => {
    let d = "";
    for (let y = 0; y <= HELIX_HEIGHT; y += 6) {
      const x = centre + amplitude * Math.sin((y / period) * 2 * Math.PI + phase);
      d += `${y === 0 ? "M" : "L"}${x.toFixed(1)} ${y}`;
    }
    return d;
  };
  const pairs: Array<{ y: number; x1: number; x2: number }> = [];
  for (let y = 12; y < HELIX_HEIGHT; y += 20) {
    const s = amplitude * Math.sin((y / period) * 2 * Math.PI);
    pairs.push({ y, x1: +(centre + s).toFixed(1), x2: +(centre - s).toFixed(1) });
  }
  return { a: strand(0), b: strand(Math.PI), pairs };
})();

function Helix({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 60 ${HELIX_HEIGHT}`}
      className={cn("absolute w-auto", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <path d={HELIX.a} strokeWidth={1.6} />
      <path d={HELIX.b} strokeWidth={1.6} />
      {HELIX.pairs.map(({ y, x1, x2 }) => (
        <line key={y} x1={x1} y1={y} x2={x2} y2={y} strokeWidth={1.1} opacity={0.55} />
      ))}
    </svg>
  );
}

/** A ring molecule with side chains — the kind drawn in a biology notebook. */
function Molecule({ className }: { className?: string }) {
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    // rounded: Math.cos/sin can differ in the last digit between server and
    // browser, which React reports as the HTML not matching
    return [+(100 + 34 * Math.cos(a)).toFixed(1), +(100 + 34 * Math.sin(a)).toFixed(1)] as const;
  });
  const chains = [
    [ring[0], [100, 30], [128, 14]],
    [ring[2], [160, 118], [186, 104]],
    [ring[4], [40, 118], [22, 144]],
  ] as const;
  return (
    <svg viewBox="0 0 200 200" className={cn("absolute", className)} fill="none" stroke="currentColor">
      <polygon points={ring.map((p) => p.join(",")).join(" ")} strokeWidth={1.6} />
      <circle cx={100} cy={100} r={20} strokeWidth={1} strokeDasharray="3 5" opacity={0.7} />
      {chains.map(([from, mid, end], i) => (
        <g key={i}>
          <path d={`M${from[0]} ${from[1]} L${mid[0]} ${mid[1]} L${end[0]} ${end[1]}`} strokeWidth={1.4} />
          <circle cx={mid[0]} cy={mid[1]} r={4} fill="currentColor" stroke="none" />
          <circle cx={end[0]} cy={end[1]} r={6} strokeWidth={1.4} />
        </g>
      ))}
      {ring.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.2} fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

/** Concentric rings and cross hairs — a microscope's field of view. */
function MicroscopeField({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 800" className={cn("absolute", className)} fill="none" stroke="currentColor">
      {[390, 310, 230, 150].map((r, i) => (
        <circle
          key={r}
          cx={400}
          cy={400}
          r={r}
          strokeWidth={1.2}
          strokeDasharray={i % 2 ? "2 10" : undefined}
          opacity={0.5 + i * 0.15}
        />
      ))}
      <path d="M400 0V800M0 400H800" strokeWidth={1} strokeDasharray="4 14" opacity={0.5} />
    </svg>
  );
}

/** "Why us": plant tissue to the sides, a DNA helix down each edge, specimens in the margins. */
function TissueLayer() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 45% 40% at 92% 8%, color-mix(in oklab, var(--primary) 11%, transparent), transparent 70%), radial-gradient(ellipse 40% 45% at 6% 92%, color-mix(in oklab, var(--highlight) 9%, transparent), transparent 70%)",
        }}
      />
      <div className="absolute inset-0" style={SIDES_ONLY}>
        <CellPattern fade={false} scale={1.15} className="text-primary/7 dark:text-primary/9" />
      </div>
      <Helix className="-left-2 top-[6%] hidden h-[34rem] rotate-[14deg] text-primary/14 lg:block dark:text-primary/18" />
      <Helix className="-right-2 bottom-[4%] hidden h-[30rem] -rotate-[12deg] text-highlight/16 lg:block dark:text-highlight/20" />
      <FloatingSpecimen name="leaf" className="left-[7%] top-[9%] size-16 text-primary/14 sm:size-20" still />
      <FloatingSpecimen name="crystal" className="right-[8%] top-[5%] size-12 text-tertiary/16 sm:size-16" still />
      <FloatingSpecimen name="mitochondria" className="right-[3%] top-[46%] hidden size-24 text-highlight/14 md:block" still />
      <FloatingSpecimen name="neuron" className="bottom-[10%] left-[3%] hidden size-24 text-primary/12 md:block" still />
    </>
  );
}

/** FAQ: a microscope field behind the timeline, lab-notebook dots, molecules in the margins. */
function LabLayer() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 35% at 50% 0%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 70%), radial-gradient(ellipse 35% 40% at 100% 70%, color-mix(in oklab, var(--highlight) 8%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 text-primary/12 dark:text-primary/16"
        style={{
          backgroundImage: "radial-gradient(currentColor 1.1px, transparent 1.6px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 75% 60% at 50% 40%, black 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 60% at 50% 40%, black 20%, transparent 75%)",
        }}
      />
      <MicroscopeField className="left-1/2 top-[10%] size-[46rem] -translate-x-1/2 text-primary/10 sm:size-[58rem] dark:text-primary/13" />
      <Helix className="-right-1 top-[34%] hidden h-[26rem] rotate-[8deg] text-primary/12 lg:block dark:text-primary/16" />
      <Molecule className="left-[3%] top-[26%] hidden size-48 -rotate-12 text-primary/13 md:block dark:text-primary/17" />
      <Molecule className="bottom-[20%] right-[3%] hidden size-40 rotate-[20deg] text-highlight/15 md:block dark:text-highlight/19" />
      <FloatingSpecimen name="cell" className="right-[9%] top-[14%] size-14 text-primary/14 sm:size-20" still />
      <FloatingSpecimen name="dna" className="left-[10%] top-[8%] hidden size-16 text-tertiary/16 sm:block" still />
      <FloatingSpecimen name="neuron" className="left-[8%] top-[60%] hidden size-20 text-primary/12 md:block" still />
      <FloatingSpecimen name="ammonite" className="bottom-[9%] left-[6%] size-14 text-highlight/14 sm:size-20" still />
    </>
  );
}

/**
 * Place as the first child of a `relative isolate` section. `tissue` suits
 * "why us"; `lab` suits the FAQ.
 */
export function SectionBackdrop({ variant }: { variant: "tissue" | "lab" }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-clip" style={EDGE_FADE}>
      {variant === "tissue" ? <TissueLayer /> : <LabLayer />}
    </div>
  );
}
