import type { StudentCommitment } from "@/api/types";
import {
  COMMITMENT_BADGE_STYLES,
  COMMITMENT_LABELS,
} from "../config/commitment-labels";

/**
 * This month's commitment, as a coloured band plus the raw fraction behind it
 * ("ملتزم · 8/10"), so the teacher can see both the verdict and its basis.
 *
 * A null level means nothing was published in the student's courses this month
 * — shown as "لا توجد بيانات", never as a weak student.
 */
export function CommitmentBadge({
  commitment,
}: {
  commitment?: StudentCommitment;
}) {
  if (!commitment || commitment.level === null) {
    return (
      <span className="inline-flex items-center rounded-lg border border-border bg-muted/40 px-2 py-1 text-[11px] font-bold text-muted-foreground">
        لا توجد بيانات
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold ${COMMITMENT_BADGE_STYLES[commitment.level]}`}
      title={`${commitment.watchedLessons} من ${commitment.releasedLessons} درس اتنشروا الشهر ده`}
    >
      {COMMITMENT_LABELS[commitment.level]}
      <span className="opacity-80">{commitment.percentage}%</span>
    </span>
  );
}
