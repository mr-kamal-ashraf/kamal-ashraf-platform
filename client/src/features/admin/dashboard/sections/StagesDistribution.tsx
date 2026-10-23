"use client";

import { useDashboard } from "../DashboardProvider";
import { StageRow } from "../components/StageRow";
import { STAGE_LIST } from "@/shared/lib/stage";

/** Each row links to the students page filtered to that stage. */
export function StagesDistribution() {
  const { stats } = useDashboard();
  if (!stats) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <h2 className="text-base font-extrabold text-foreground sm:text-lg">
        توزيع الطلاب على المراحل
      </h2>
      <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-3">
        {STAGE_LIST.map((s) => (
          <StageRow
            key={s.key}
            label={s.longLabel}
            value={stats.students.byStage[s.key] ?? 0}
            total={stats.students.total}
            href={`/admin/students?stage=${s.key}`}
          />
        ))}
      </div>
    </section>
  );
}
