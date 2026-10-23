"use client";

import { formatEgp } from "@/shared/lib/money";
import { useSales } from "../SalesProvider";

interface SummaryCardProps {
  label: string;
  value: string;
  hint?: string;
  accent: "primary" | "success" | "warning" | "danger";
}

const ACCENT_STYLES: Record<SummaryCardProps["accent"], string> = {
  primary: "border-primary/30 bg-primary/5 text-primary",
  success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-600",
  danger: "border-red-500/30 bg-red-500/5 text-red-600",
};

function SummaryCard({ label, value, hint, accent }: SummaryCardProps) {
  return (
    <div className={`rounded-2xl border-2 p-4 sm:p-5 ${ACCENT_STYLES[accent]}`}>
      <div className="text-[11px] font-semibold leading-snug opacity-80 sm:text-xs">
        {label}
      </div>
      <div className="mt-2 text-xl font-extrabold sm:text-2xl">{value}</div>
      {hint ? (
        <div className="mt-1 text-[11px] font-semibold opacity-70">{hint}</div>
      ) : null}
    </div>
  );
}

/**
 * Platform-wide revenue figures, plus the two numbers that quietly signal a
 * problem: revoked sales, and online checkouts that never completed.
 */
export function SalesSummaryCards() {
  const { summary } = useSales();
  if (!summary) return null;

  const unfinished = summary.pendingAttempts + summary.failedAttempts;

  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <SummaryCard
        label="إجمالي المبيعات"
        value={formatEgp(summary.totalRevenue)}
        hint={`${summary.salesCount.toLocaleString("ar-EG")} عملية بيع`}
        accent="success"
      />
      <SummaryCard
        label="مبيعات الشهر الحالي"
        value={formatEgp(summary.monthRevenue)}
        hint={`النهارده: ${formatEgp(summary.todayRevenue)}`}
        accent="primary"
      />
      <SummaryCard
        label="أونلاين / كاش / أكواد"
        value={formatEgp(summary.onlineRevenue)}
        hint={`كاش: ${formatEgp(summary.cashRevenue)} · أكواد: ${formatEgp(summary.codeRevenue)}`}
        accent="primary"
      />
      <SummaryCard
        label="متوسط قيمة العملية"
        value={formatEgp(summary.averageSale)}
        hint={
          summary.revokedCount > 0
            ? `${summary.revokedCount.toLocaleString("ar-EG")} عملية ملغية`
            : "مفيش عمليات ملغية"
        }
        accent="warning"
      />

      {unfinished > 0 ? (
        <div className="col-span-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs font-semibold text-amber-700 xl:col-span-4">
          فيه {unfinished.toLocaleString("ar-EG")} محاولة دفع أونلاين ما اكتملتش
          في آخر {summary.attemptsWindowDays} يوم (
          {summary.pendingAttempts.toLocaleString("ar-EG")} معلّقة و
          {summary.failedAttempts.toLocaleString("ar-EG")} فاشلة). لو الرقم ده
          بيزيد، غالباً فيه مشكلة في بوابة الدفع تستاهل متابعة.
        </div>
      ) : null}

      {summary.topCourses.length > 0 ? (
        <div className="col-span-2 rounded-2xl border border-border bg-card p-4 xl:col-span-4">
          <h2 className="text-sm font-extrabold text-foreground">
            الأكثر مبيعاً
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {summary.topCourses.map((course) => (
              <li
                key={course.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-bold">
                  {course.title}
                </span>
                <span className="shrink-0 font-bold text-primary">
                  {formatEgp(course.revenue)}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {course.salesCount.toLocaleString("ar-EG")} عملية
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
