import Link from "next/link";
import type { ReactNode } from "react";

export type DashboardAccent = "primary" | "success" | "warning" | "danger";

const DASHBOARD_ACCENT_STYLES: Record<DashboardAccent, string> = {
  primary: "border-primary/30 bg-primary/5 text-primary",
  success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-600",
  danger: "border-red-500/30 bg-red-500/5 text-red-600",
};

const BASE_CLASSES =
  "block rounded-2xl border-2 p-4 transition-transform hover:-translate-y-1 sm:p-5";

interface StatCardProps {
  label: string;
  value: number;
  accent: DashboardAccent;
  /**
   * Where the card drills down to, usually the matching section with its
   * filter already applied (e.g. /admin/students?status=active). Omit it for a
   * figure that has no list behind it — the card then renders as a plain box.
   */
  href?: string;
  /** Small line under the number, e.g. a currency or a secondary figure. */
  hint?: ReactNode;
  /** Formats the number; defaults to Arabic digit grouping. */
  formatValue?: (value: number) => string;
}

export function StatCard({
  label,
  value,
  accent,
  href,
  hint,
  formatValue,
}: StatCardProps) {
  const body = (
    <>
      <div className="text-[11px] font-semibold leading-snug opacity-80 sm:text-xs">
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold sm:text-3xl">
        {formatValue ? formatValue(value) : value.toLocaleString("ar-EG")}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] font-semibold opacity-70">{hint}</div>
      ) : null}
    </>
  );

  const className = `${BASE_CLASSES} ${DASHBOARD_ACCENT_STYLES[accent]}`;

  if (!href) return <div className={className}>{body}</div>;

  return (
    <Link
      href={href}
      className={`${className} focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2`}
    >
      {body}
    </Link>
  );
}
