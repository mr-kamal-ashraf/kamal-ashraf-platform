/**
 * Academic stages taught on this platform — the single source of truth for the
 * whole frontend (badges, selects, filters, registration). Must match the
 * backend's STAGES enum in server/src/config/constants.ts.
 */
export type Stage = "prep3" | "sec1" | "sec3";

/** The stage values as a runtime list, in academic order. */
export const STAGE_VALUES = ["prep3", "sec1", "sec3"] as const;

export interface StageInfo {
  key: Stage;
  label: string;
  shortLabel: string;
  longLabel: string;
  colorVar: string;
  gradientVar: string;
}

export const STAGES: Record<Stage, StageInfo> = {
  prep3: {
    key: "prep3",
    label: "تالتة إعدادي",
    shortLabel: "٣ع",
    longLabel: "الصف الثالث الإعدادي",
    colorVar: "--stage-1",
    gradientVar: "--gradient-stage-1",
  },
  sec1: {
    key: "sec1",
    label: "أولى ثانوي",
    shortLabel: "١ث",
    longLabel: "الصف الأول الثانوي",
    colorVar: "--stage-2",
    gradientVar: "--gradient-stage-2",
  },
  sec3: {
    key: "sec3",
    label: "تالتة ثانوي",
    shortLabel: "٣ث",
    longLabel: "الصف الثالث الثانوي",
    colorVar: "--stage-3",
    gradientVar: "--gradient-stage-3",
  },
};

export const STAGE_LABELS: Record<Stage, string> = {
  prep3: STAGES.prep3.label,
  sec1: STAGES.sec1.label,
  sec3: STAGES.sec3.label,
};

export const STAGE_LONG_LABELS: Record<Stage, string> = {
  prep3: STAGES.prep3.longLabel,
  sec1: STAGES.sec1.longLabel,
  sec3: STAGES.sec3.longLabel,
};

/** Stages in academic order, for rendering selects and lists. */
export const STAGE_LIST: readonly StageInfo[] = STAGE_VALUES.map(
  (s) => STAGES[s],
);

/** The stage a new form starts on. */
export const DEFAULT_STAGE: Stage = "prep3";

/** Narrow an unknown value (API data, query params) to a known stage. */
export function isStage(value: unknown): value is Stage {
  return (
    typeof value === "string" &&
    (STAGE_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Cover background for a lesson/course without its own thumbnail. Each stage
 * gradient is a theme token, so it follows the active palette and dark mode.
 */
export function getLessonGradient(
  stage: Stage,
  customGradient?: string | null,
): string {
  if (customGradient) return customGradient;
  const info = isStage(stage) ? STAGES[stage] : STAGES[DEFAULT_STAGE];
  return `var(${info.gradientVar})`;
}
