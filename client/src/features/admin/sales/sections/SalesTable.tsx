"use client";

import Link from "next/link";
import { formatEgp } from "@/shared/lib/money";
import { useSales } from "../SalesProvider";
import { SaleSourceBadge, SaleStatusBadge } from "../components/SaleSourceBadge";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

/** Sales are dated in Egypt's time, wherever the teacher opens the panel from. */
const TIME_ZONE = "Africa/Cairo";

/** "١٤ سبتمبر ٢٠٢٦" — the date the money came in. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

/** "٨:٣٠ م" — and the time. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

export function SalesTable() {
  const { isLoading, error, data } = useSales();

  // First load: the full loading screen. A reload (search / filter / page)
  // keeps the current rows up, dimmed, until the new ones arrive.
  if (isLoading && !data) return <LoadingScreen variant="page" />;

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
        مفيش عمليات بيع مطابقة للفلاتر
      </div>
    );
  }

  return (
    <div
      aria-busy={isLoading}
      className={isLoading ? "brand-loader--refreshing space-y-5 sm:space-y-6" : "space-y-5 sm:space-y-6"}
    >
      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-xs font-bold text-foreground">
        إجمالي المبيعات النشطة في النتائج المعروضة:{" "}
        <span className="text-primary">{formatEgp(data.filteredRevenue)}</span>
      </div>

      {/* Cards on phones, table from lg up — same data, two densities. */}
      <ul className="grid gap-3 lg:hidden">
        {data.items.map((sale) => (
          <li
            key={sale.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {sale.student ? (
                  <Link
                    href={`/admin/students/${sale.student.id}`}
                    className="truncate text-sm font-extrabold text-primary hover:underline"
                  >
                    {sale.student.name}
                  </Link>
                ) : (
                  <span className="text-sm font-extrabold text-muted-foreground">
                    طالب محذوف
                  </span>
                )}
                <div className="mt-1 truncate text-[11px] text-muted-foreground">
                  {sale.course?.title ?? "كورس محذوف"}
                </div>
              </div>
              <div className="shrink-0 text-sm font-extrabold">
                {formatEgp(sale.amount)}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SaleSourceBadge source={sale.source} />
              <SaleStatusBadge status={sale.status} />
              <span className="text-[11px] text-muted-foreground">
                {formatDate(sale.soldAt)} · {formatTime(sale.soldAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">الطالب</th>
                <th className="px-4 py-3">رقم الطالب</th>
                <th className="px-4 py-3">الكورس</th>
                <th className="px-4 py-3">المبلغ</th>
                <th className="px-4 py-3">طريقة الدفع</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">رقم العملية</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-t border-border/60 transition-colors hover:bg-muted/30"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    <div>{formatDate(sale.soldAt)}</div>
                    <div className="mt-0.5 text-[11px]">{formatTime(sale.soldAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    {sale.student ? (
                      <Link
                        href={`/admin/students/${sale.student.id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {sale.student.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">طالب محذوف</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {sale.student?.studentPhone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {sale.course?.title ?? "كورس محذوف"}
                  </td>
                  <td className="px-4 py-3 text-xs font-extrabold">
                    {formatEgp(sale.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <SaleSourceBadge source={sale.source} />
                  </td>
                  <td className="px-4 py-3">
                    <SaleStatusBadge status={sale.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                    {sale.transactionRef ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
