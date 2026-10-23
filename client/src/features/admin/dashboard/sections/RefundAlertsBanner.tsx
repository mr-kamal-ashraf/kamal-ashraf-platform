import Link from "next/link";
import { useDashboard } from "../DashboardProvider";

/**
 * Students charged without getting a new course — only shown while there are
 * some. The list (and the "dealt with" button) lives in the sales section.
 */
export function RefundAlertsBanner() {
  const { stats } = useDashboard();
  const count = stats?.refundAlerts ?? 0;
  if (count === 0) return null;

  return (
    <Link
      href="/admin/sales"
      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 transition hover:bg-amber-500/10"
    >
      <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400">
        ⚠️ فيه {count.toLocaleString("ar-EG")}{" "}
        {count === 1 ? "دفعة محتاجة" : "دفعات محتاجة"} استرجاع لطلاب
      </span>
      <span className="text-xs font-bold text-primary">شوفها ←</span>
    </Link>
  );
}
