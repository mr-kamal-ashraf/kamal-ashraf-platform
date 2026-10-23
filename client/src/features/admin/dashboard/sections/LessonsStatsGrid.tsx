"use client";

import { useDashboard } from "../DashboardProvider";
import { StatCard } from "../components/StatCard";

/**
 * Lesson headline figures, each linking to the lessons page with the matching
 * publish filter applied.
 */
export function LessonsStatsGrid() {
  const { stats } = useDashboard();
  if (!stats) return null;

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <StatCard
        label="إجمالي الدروس"
        value={stats.lessons.total}
        accent="primary"
        href="/admin/lessons"
      />
      <StatCard
        label="منشور"
        value={stats.lessons.published}
        accent="success"
        href="/admin/lessons?published=true"
      />
      <StatCard
        label="مسودة"
        value={stats.lessons.draft}
        accent="warning"
        href="/admin/lessons?published=false"
      />
    </section>
  );
}
