"use client";

import { useDashboard } from "../DashboardProvider";
import { StatCard } from "../components/StatCard";

/**
 * Student headline figures. Each card drills down to the students page with the
 * matching status filter already applied, so the teacher goes from the number
 * straight to the people behind it.
 */
export function StudentsStatsGrid() {
  const { stats } = useDashboard();
  if (!stats) return null;

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="إجمالي الطلاب"
        value={stats.students.total}
        accent="primary"
        href="/admin/students"
      />
      <StatCard
        label="طلاب مفعلين"
        value={stats.students.active}
        accent="success"
        href="/admin/students?status=active"
      />
      <StatCard
        label="بانتظار التفعيل"
        value={stats.students.pendingActivation}
        accent="warning"
        href="/admin/students?status=pending"
      />
      <StatCard
        label="حسابات معلقة"
        value={stats.students.suspended}
        accent="danger"
        href="/admin/students?status=suspended"
      />
    </section>
  );
}
