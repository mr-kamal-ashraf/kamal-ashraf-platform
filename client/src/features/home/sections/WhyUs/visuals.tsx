import type { CSSProperties } from "react";
import { BioIcon, MiniCell, type BioIconName } from "@/shared/components/bio";

/*
 * Small static illustrations, one per "why us" feature. Pure SVG/HTML in
 * theme colors — nothing animates continuously, so they cost nothing.
 */

const VB_W = 260;
const VB_H = 200;
const at = (x: number, y: number): CSSProperties => ({
  left: `${(x / VB_W) * 100}%`,
  top: `${(y / VB_H) * 100}%`,
  transform: "translate(-50%, -50%)",
});

const CELL_LABELS: Array<{ label: string; from: [number, number]; to: [number, number] }> = [
  { label: "النواة", from: [112, 88], to: [54, 24] },
  { label: "الغشاء البلازمي", from: [212, 72], to: [212, 20] },
  { label: "الميتوكوندريا", from: [180, 134], to: [206, 184] },
  { label: "جهاز جولجي", from: [80, 140], to: [52, 182] },
];

/** 1 · "Detailed explanation" — a labelled textbook cell. */
export function AnnotatedCell() {
  return (
    <div className="relative mx-auto aspect-13/10 w-full max-w-sm">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="absolute inset-0 size-full" aria-hidden>
        {/* membrane */}
        <path
          d="M138 30 C188 33 226 66 224 110 C222 154 182 182 132 180 C80 178 40 148 40 104 C40 60 86 27 138 30Z"
          fill="var(--primary)"
          fillOpacity="0.07"
          stroke="var(--primary)"
          strokeOpacity="0.7"
          strokeWidth="1.8"
        />
        {/* endoplasmic reticulum */}
        <g fill="none" stroke="var(--primary)" strokeOpacity="0.28" strokeWidth="1.3" strokeLinecap="round">
          <path d="M80 70 q-12 32 3 62" />
          <path d="M70 76 q-9 26 2 50" />
          <path d="M150 128 q20 6 34-6" />
        </g>
        {/* nucleus */}
        <circle cx="116" cy="94" r="30" fill="var(--primary)" fillOpacity="0.16" stroke="var(--primary)" strokeOpacity="0.75" strokeWidth="1.5" />
        <circle cx="124" cy="88" r="9" fill="var(--primary)" fillOpacity="0.75" />
        {/* mitochondrion */}
        <g transform="rotate(-28 180 134)">
          <ellipse cx="180" cy="134" rx="22" ry="11" fill="var(--highlight)" fillOpacity="0.14" stroke="var(--highlight)" strokeWidth="1.5" />
          <path d="M162 134 c4-7 8 7 12 0 s8 7 12 0 8 7 12 0" fill="none" stroke="var(--highlight)" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        {/* golgi */}
        <g fill="none" stroke="var(--highlight)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M66 136 q14 -8 28 0" />
          <path d="M68 142 q12 -7 24 0" />
          <path d="M71 148 q9 -5 18 0" />
        </g>
        {/* ribosomes */}
        <g fill="var(--primary)" fillOpacity="0.55">
          <circle cx="170" cy="70" r="2" />
          <circle cx="182" cy="96" r="1.7" />
          <circle cx="100" cy="148" r="1.7" />
          <circle cx="150" cy="160" r="2" />
          <circle cx="96" cy="58" r="1.6" />
        </g>
        {/* leader lines */}
        <g stroke="var(--foreground)" strokeOpacity="0.35" strokeWidth="1" fill="none">
          {CELL_LABELS.map(({ from, to }) => (
            <line key={`${from}`} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} strokeDasharray="3 3" />
          ))}
        </g>
        <g fill="var(--foreground)">
          {CELL_LABELS.map(({ from }) => (
            <circle key={`${from}`} cx={from[0]} cy={from[1]} r="2.6" />
          ))}
        </g>
      </svg>

      {CELL_LABELS.map(({ label, to }) => (
        <span
          key={label}
          className="absolute whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-foreground shadow-soft sm:text-[11px]"
          style={at(to[0], to[1])}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

const OUTLINE = [
  { label: "تركيب كل جزء", done: true },
  { label: "وظيفته وأهميته", done: true },
  { label: "أمثلة ورسومات توضيحية", done: true },
  { label: "أسئلة على كل نقطة", done: false },
];

/** 1 · the tall card: the labelled cell plus a lesson outline being ticked off. */
export function DetailedLesson() {
  return (
    <div className="flex flex-col gap-5">
      <AnnotatedCell />
      <ul className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-soft">
        {OUTLINE.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-xs font-semibold text-foreground">
            <span
              className={
                item.done
                  ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  : "flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-primary/40"
              }
            >
              {item.done && (
                <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className={item.done ? "" : "text-muted-foreground"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEPS = ["اقرأ السؤال", "حدد المطلوب", "وصّل للحل"];
const LEVELS = ["مباشر", "تطبيق", "تفكير عليا"];

/** 2 · "Step-by-step solving" — three connected steps + difficulty ladder. */
export function SolveSteps() {
  return (
    <div className="flex h-full flex-col justify-center gap-6 py-2">
      <ol className="relative grid grid-cols-3">
        <span
          aria-hidden
          className="absolute inset-x-[16.6%] top-[18px] h-0.5 rounded-full bg-primary"
        />
        {STEPS.map((step, i) => {
          const last = i === STEPS.length - 1;
          return (
            <li key={step} className="relative flex flex-col items-center gap-2 text-center">
              <span
                className={
                  last
                    ? "flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-brand"
                    : "flex size-9 items-center justify-center rounded-full border-2 border-primary bg-card text-sm font-black text-primary"
                }
              >
                {last ? (
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className="text-[11px] font-bold text-foreground sm:text-xs">{step}</span>
            </li>
          );
        })}
      </ol>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-muted-foreground sm:text-[11px]">
          {LEVELS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <span className="h-1.5 rounded-full bg-primary/35" />
          <span className="h-1.5 rounded-full bg-primary/65" />
          <span className="h-1.5 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}

/** 3 · "Enjoyable learning" — a crisp HD lesson player. */
export function LessonPlayer() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="relative aspect-video bg-primary/8">
        <span className="absolute start-2.5 top-2.5 rounded-md bg-card px-1.5 py-0.5 text-[10px] font-black text-primary shadow-soft">
          HD
        </span>
        <span className="absolute end-2.5 top-2.5 flex items-end gap-0.5" aria-hidden>
          {[6, 11, 8, 13, 7].map((h, i) => (
            <span key={i} className="w-0.5 rounded-full bg-primary/60" style={{ height: h }} />
          ))}
        </span>
        <MiniCell animated={false} className="absolute bottom-3 start-3 size-7 text-primary/30" />
        <span className="absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-brand ring-4 ring-primary/15">
          <svg className="size-5 translate-x-px" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5" dir="ltr">
        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">12:40</span>
        <span className="relative h-1 flex-1 rounded-full bg-foreground/10">
          <span className="absolute inset-y-0 left-0 w-[62%] rounded-full bg-primary" />
          <span className="absolute left-[62%] top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary" />
        </span>
        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">20:15</span>
      </div>
    </div>
  );
}

const HUB: Array<{ label: string; icon: BioIconName; pos: string }> = [
  { label: "الشرح", icon: "book", pos: "left-1/2 top-0 -translate-x-1/2" },
  { label: "التدريبات", icon: "layers", pos: "right-0 top-1/2 -translate-y-1/2" },
  { label: "المراجعات", icon: "dna", pos: "bottom-0 left-1/2 -translate-x-1/2" },
  { label: "الامتحانات", icon: "award", pos: "left-0 top-1/2 -translate-y-1/2" },
];

/** 4 · "Complete system" — everything orbiting one hub. */
export function AllInOneHub() {
  return (
    <div className="relative mx-auto aspect-[1.55] w-full max-w-xs" dir="ltr">
      <svg viewBox="0 0 155 100" className="absolute inset-0 size-full" aria-hidden>
        <g stroke="var(--primary)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 3">
          <line x1="77.5" y1="14" x2="77.5" y2="86" />
          <line x1="20" y1="50" x2="135" y2="50" />
        </g>
        <circle cx="77.5" cy="50" r="27" fill="none" stroke="var(--primary)" strokeOpacity="0.18" />
      </svg>
      <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-brand">
        <MiniCell animated={false} className="size-6" />
      </span>
      {HUB.map((h) => (
        <span
          key={h.label}
          className={`absolute ${h.pos} inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-card px-2 py-1 text-[10px] font-bold text-foreground shadow-soft sm:text-[11px]`}
        >
          <BioIcon name={h.icon} className="size-3.5 text-primary" />
          {h.label}
        </span>
      ))}
    </div>
  );
}
