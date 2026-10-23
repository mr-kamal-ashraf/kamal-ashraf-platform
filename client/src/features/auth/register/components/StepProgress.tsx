"use client";

import { motion } from "framer-motion";
import { toArabicDigits } from "@/shared/lib/arabic";
import { cn } from "@/shared/lib/cn";

function CheckIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

interface StepProgressProps {
  step: number;
  steps: readonly { title: string }[];
}

/**
 * Wizard progress indicator for the registration flow: a filling track with a
 * numbered node per step. Completed steps show a check, the current step is
 * highlighted, and upcoming steps stay muted. RTL-aware.
 */
export function StepProgress({ step, steps }: StepProgressProps) {
  const total = steps.length;
  const inset = 50 / total; // % — half a column, so the track meets node centers
  const trackLen = 100 - 2 * inset; // % — distance between first and last node
  const fillPct = total > 1 ? (step / (total - 1)) * trackLen : 0;

  return (
    <div className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold text-primary">
          الخطوة {toArabicDigits(step + 1)} من {toArabicDigits(total)}
        </span>
        <span className="text-sm font-extrabold text-foreground">
          {steps[step]?.title}
        </span>
      </div>

      <div className="relative">
        {/* track */}
        <div
          className="absolute top-5 h-1 -translate-y-1/2 rounded-full bg-border"
          style={{ right: `${inset}%`, left: `${inset}%` }}
          aria-hidden
        />
        {/* fill */}
        <motion.div
          className="absolute top-5 h-1 -translate-y-1/2 rounded-full bg-gradient-brand"
          style={{ right: `${inset}%` }}
          initial={false}
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          aria-hidden
        />

        {/* nodes */}
        <ol
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {steps.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s.title} className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-extrabold transition-all duration-300",
                    done &&
                      "border-transparent bg-gradient-brand text-primary-foreground shadow-brand",
                    current &&
                      "border-primary bg-primary/10 text-primary shadow-soft",
                    !done &&
                      !current &&
                      "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <CheckIcon /> : toArabicDigits(i + 1)}
                </div>
                <span
                  className={cn(
                    "max-w-[5.5rem] text-center text-[10px] font-bold leading-tight sm:text-xs",
                    done || current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.title}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
