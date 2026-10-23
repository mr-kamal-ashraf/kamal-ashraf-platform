"use client";

import { formatEgp } from "@/shared/lib/money";
import { useDashboard } from "../DashboardProvider";
import { StatCard } from "../components/StatCard";

/**
 * Revenue headline. Both cards drill into the sales section — the month card
 * lands there already filtered to the current month, which is the figure the
 * teacher usually wants the detail behind.
 */
export function SalesStatsGrid() {
  const { stats } = useDashboard();
  if (!stats) return null;

  const { sales } = stats;
  const monthStart = new Date();
  monthStart.setDate(1);
  const from = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-01`;

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <StatCard
        label="إجمالي المبيعات"
        value={sales.totalRevenue}
        accent="success"
        href="/admin/sales"
        formatValue={formatEgp}
        hint={`${sales.salesCount.toLocaleString("ar-EG")} عملية بيع`}
      />
      <StatCard
        label="مبيعات الشهر الحالي"
        value={sales.monthRevenue}
        accent="primary"
        href={`/admin/sales?from=${from}`}
        formatValue={formatEgp}
        hint={`${sales.monthSalesCount.toLocaleString("ar-EG")} عملية الشهر ده`}
      />
      <StatCard
        label="الكورسات المباعة"
        value={sales.salesCount}
        accent="warning"
        href="/admin/sales"
        hint="إجمالي الاشتراكات النشطة"
      />
    </section>
  );
}
