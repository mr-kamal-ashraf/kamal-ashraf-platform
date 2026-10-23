import type { CommitmentLevel } from "@/api/types";

/**
 * Monthly commitment bands.
 *
 * نسبة الالتزام = عدد الدروس اللي الطالب خلّصها هذا الشهر ÷ عدد الدروس
 * اللي اتنشرت له في كورساته هذا الشهر.
 */
export type CommitmentFilter = "" | CommitmentLevel;

export const COMMITMENT_VALUES = ["high", "medium", "low"] as const;

export const COMMITMENT_LABELS: Record<CommitmentLevel, string> = {
  high: "ملتزم",
  medium: "متوسط",
  low: "ضعيف",
};

/** Filter-dropdown wording, which states the band so the teacher sees the rule. */
export const COMMITMENT_FILTER_LABELS: Record<CommitmentLevel, string> = {
  high: "ملتزم (70% فأكثر)",
  medium: "متوسط (30% - 69%)",
  low: "ضعيف (أقل من 30%)",
};

/** Badge colours, matching the dashboard's success / warning / danger accents. */
export const COMMITMENT_BADGE_STYLES: Record<CommitmentLevel, string> = {
  high: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  low: "border-red-500/30 bg-red-500/10 text-red-600",
};

/** Shown in the teacher-facing tooltip so the number is never a mystery. */
export const COMMITMENT_RULE_HINT =
  "نسبة الالتزام = الدروس اللي الطالب خلّصها ÷ الدروس اللي اتنشرت في كورساته الشهر ده";
