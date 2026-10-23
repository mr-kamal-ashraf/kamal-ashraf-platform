"use client";

import { motion } from "framer-motion";
import { toArabicDigits } from "@/shared/lib/arabic";
import { cn } from "@/shared/lib/cn";

function CheckIcon() {
  return (
    <svg
      className="size-4"
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

/**
 * Compact horizontal step indicator for admin create-wizards (new course /
 * new lesson). A filling track with a numbered node per step; done steps show
 * a check, the current step is highlighted. RTL-aware.
 */
export function StepProgress({
  step,
  steps,
}: {
  step: number;
  steps: readonly { title: string }[];
}) {
  const total = steps.length;
  const inset = 50 / total;
  const trackLen = 100 - 2 * inset;
  const fillPct = total > 1 ? (step / (total - 1)) * trackLen : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold text-primary">
          الخطوة {toArabicDigits(step + 1)} من {toArabicDigits(total)}
        </span>
        <span className="text-sm font-extrabold text-foreground">
          {steps[step]?.title}
        </span>
      </div>

      <div className="relative">
        <div
          className="absolute top-4 h-1 -translate-y-1/2 rounded-full bg-border"
          style={{ right: `${inset}%`, left: `${inset}%` }}
          aria-hidden
        />
        <motion.div
          className="absolute top-4 h-1 -translate-y-1/2 rounded-full bg-gradient-brand"
          style={{ right: `${inset}%` }}
          initial={false}
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          aria-hidden
        />
        <ol
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {steps.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s.title} className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 text-xs font-extrabold transition-all duration-300",
                    done &&
                      "border-transparent bg-gradient-brand text-primary-foreground shadow-brand",
                    current && "border-primary bg-primary/10 text-primary",
                    !done &&
                      !current &&
                      "border-border bg-background text-muted-foreground",
                  )}
                >
                  {done ? <CheckIcon /> : toArabicDigits(i + 1)}
                </div>
                <span
                  className={cn(
                    "max-w-[6.5rem] text-center text-[10px] font-bold leading-tight",
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
