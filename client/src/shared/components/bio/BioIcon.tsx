import type { ReactNode, SVGProps } from "react";

/**
 * The platform's biology + geology icon set — line glyphs drawn with
 * `currentColor`, so they take the text color of wherever they're placed.
 *
 * Two families share one component:
 *  - "specimens" (dna, cell, leaf, crystal, ammonite, …) drawn on a 64 grid,
 *    used large and faint as decoration and as cover art for cards.
 *  - small UI glyphs (microscope, layers, users, …) on a 24 grid.
 */
export type BioIconName =
  | "dna"
  | "cell"
  | "leaf"
  | "crystal"
  | "ammonite"
  | "mitochondria"
  | "neuron"
  | "strata"
  | "molecule"
  | "microscope"
  | "layers"
  | "award"
  | "heartPulse"
  | "users"
  | "book"
  | "sprout"
  | "mountain"
  | "spark";

/** The decorative specimens, in the order cards cycle through them. */
export const SPECIMENS = [
  "dna",
  "cell",
  "leaf",
  "crystal",
  "ammonite",
  "mitochondria",
  "neuron",
  "strata",
] as const satisfies readonly BioIconName[];

export type SpecimenName = (typeof SPECIMENS)[number];

const GLYPHS: Record<BioIconName, { box: number; body: ReactNode }> = {
  dna: {
    box: 64,
    body: (
      <>
        <path d="M18 4 C18 14 46 18 46 32 C46 46 18 50 18 60" />
        <path d="M46 4 C46 14 18 18 18 32 C18 46 46 50 46 60" />
        <path d="M21 9 H43" opacity={0.7} />
        <path d="M26 24 H38" opacity={0.7} />
        <path d="M20 32 H44" opacity={0.7} />
        <path d="M26 40 H38" opacity={0.7} />
        <path d="M21 55 H43" opacity={0.7} />
      </>
    ),
  },
  cell: {
    box: 64,
    body: (
      <>
        <path d="M33 5 C47 6 58 17 57 32 C56 47 46 58 31 58 C16 58 6 46 7 31 C8 16 19 4 33 5Z" />
        <circle cx="29" cy="30" r="10" />
        <circle cx="31" cy="28" r="3" fill="currentColor" stroke="none" />
        <ellipse cx="44" cy="43" rx="6" ry="3" transform="rotate(-30 44 43)" />
        <path d="M40 44.5 Q42 41 44 44 T48 42" opacity={0.7} />
        <circle cx="18" cy="45" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="46" cy="19" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="21" cy="17" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="36" cy="49" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),
  },
  leaf: {
    box: 64,
    body: (
      <>
        <path d="M10 54 C10 27 29 9 55 9 C55 35 37 54 10 54Z" />
        <path d="M10 54 C24 40 36 28 48 16" />
        <path d="M21 43 C19 38 19 35 20 30" opacity={0.75} />
        <path d="M28 36 C33 37 37 38 42 37" opacity={0.75} />
        <path d="M32 32 C31 27 31 24 33 19" opacity={0.75} />
        <path d="M38 26 C42 27 45 27 49 25" opacity={0.75} />
      </>
    ),
  },
  crystal: {
    box: 64,
    body: (
      <>
        <path d="M32 3 L42 15 L42 46 L32 59 L22 46 L22 15 Z" />
        <path d="M22 15 L32 21 L42 15 M32 21 V59" opacity={0.75} />
        <path d="M13 29 L19 35 L19 51 L13 57 L7 51 L7 35 Z" />
        <path d="M7 35 L13 39 L19 35" opacity={0.75} />
        <path d="M51 25 L57 32 L57 50 L51 56 L45 50 L45 32 Z" />
        <path d="M45 32 L51 36 L57 32" opacity={0.75} />
      </>
    ),
  },
  ammonite: {
    box: 64,
    body: (
      <>
        <path d="M32 32 A3 3 0 0 1 38 32 A6 6 0 0 1 26 32 A9 9 0 0 1 44 32 A12 12 0 0 1 20 32 A15 15 0 0 1 50 32 A18 18 0 0 1 14 32" />
        <path
          d="M14 32 L20 32 M16.5 22 L21.5 25 M23 15.5 L26.5 20.5 M32 13.5 V18.5 M41 15.5 L38.5 20 M47.5 21 L43.5 24 M50 32 L44 32"
          opacity={0.7}
        />
      </>
    ),
  },
  mitochondria: {
    box: 64,
    body: (
      <>
        <path d="M8 34 C8 20 22 14 34 14 C48 14 57 22 57 31 C57 44 44 50 31 50 C17 50 8 45 8 34Z" />
        <path d="M14 32 C17 24 19 40 23 30 C26 22 28 41 32 30 C35 22 37 41 41 30 C44 22 46 40 50 31" />
      </>
    ),
  },
  neuron: {
    box: 64,
    body: (
      <>
        <circle cx="22" cy="24" r="7" />
        <circle cx="22" cy="24" r="2.4" fill="currentColor" stroke="none" />
        <path d="M17 19 L9 9 M15 25 L5 27 M19 30 L13 40 M24 17 L25 6" />
        <path d="M28 28 C36 34 42 40 48 50" />
        <path d="M48 50 L56 52 M48 50 L50 58 M48 50 L58 45" />
        <path d="M33 32 l3 -2 M38 37 l3 -2 M43 43 l3 -2" opacity={0.7} />
      </>
    ),
  },
  strata: {
    box: 64,
    body: (
      <>
        <path d="M4 20 C14 14 24 24 34 18 C44 12 52 20 60 16" />
        <path d="M4 32 C14 26 24 36 34 30 C44 24 52 32 60 28" />
        <path d="M4 44 C14 38 24 48 34 42 C44 36 52 44 60 40" />
        <path d="M4 56 C14 50 24 60 34 54 C44 48 52 56 60 52" />
        <circle cx="18" cy="26" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="44" cy="35" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="28" cy="49" r="1.5" fill="currentColor" stroke="none" />
        <path d="M46 46 l3 4 l-5 0 z" opacity={0.7} />
      </>
    ),
  },
  molecule: {
    box: 24,
    body: (
      <>
        <circle cx="12" cy="12" r="2.5" />
        <circle cx="5" cy="6" r="2" />
        <circle cx="19" cy="6" r="2" />
        <circle cx="12" cy="20.5" r="2" />
        <path d="M10.2 10.3 6.5 7.3M13.8 10.3l3.7-3M12 14.5v4" />
      </>
    ),
  },
  microscope: {
    box: 24,
    body: (
      <>
        <path d="M6 18h8" />
        <path d="M3 22h18" />
        <path d="M14 22a7 7 0 1 0 0-14h-1" />
        <path d="M9 14h2" />
        <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
        <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
      </>
    ),
  },
  layers: {
    box: 24,
    body: (
      <>
        <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
        <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
        <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
      </>
    ),
  },
  award: {
    box: 24,
    body: (
      <>
        <path d="m15.48 12.89 1.51 8.53a.5.5 0 0 1-.81.47l-3.58-2.69a1 1 0 0 0-1.2 0l-3.59 2.69a.5.5 0 0 1-.81-.47l1.51-8.53" />
        <circle cx="12" cy="8" r="6" />
      </>
    ),
  },
  heartPulse: {
    box: 24,
    body: (
      <>
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
      </>
    ),
  },
  users: {
    box: 24,
    body: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  book: {
    box: 24,
    body: (
      <>
        <path d="M12 7v14" />
        <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      </>
    ),
  },
  sprout: {
    box: 24,
    body: (
      <>
        <path d="M7 20h10" />
        <path d="M10 20c5.5-2.5.8-6.4 3-10" />
        <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
        <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
      </>
    ),
  },
  mountain: {
    box: 24,
    body: (
      <>
        <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
        <path d="M4.5 15.5 7 14l2 1.5 2-1 2.5 1.5" opacity={0.7} />
      </>
    ),
  },
  spark: {
    box: 24,
    body: (
      <path d="M12 2 L13.6 9.2 L21 12 L13.6 14.8 L12 22 L10.4 14.8 L3 12 L10.4 9.2 Z" />
    ),
  },
};

interface BioIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: BioIconName;
  /** Stroke weight in the glyph's own units. Defaults suit each grid. */
  strokeWidth?: number;
}

export function BioIcon({
  name,
  strokeWidth,
  className,
  ...rest
}: BioIconProps) {
  const glyph = GLYPHS[name];
  return (
    <svg
      viewBox={`0 0 ${glyph.box} ${glyph.box}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? (glyph.box === 64 ? 2.4 : 2)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...rest}
    >
      {glyph.body}
    </svg>
  );
}

/** Deterministically pick a specimen for a slug/id, so a card's art is stable. */
export function pickSpecimen(seed: string): SpecimenName {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return SPECIMENS[Math.abs(hash) % SPECIMENS.length];
}
