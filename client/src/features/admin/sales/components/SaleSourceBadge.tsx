import type { SaleSource, SaleStatus } from "@/api";

const SOURCE_STYLES: Record<SaleSource, string> = {
  paymob: "border-primary/30 bg-primary/10 text-primary",
  cash: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  code: "border-amber-500/30 bg-amber-500/10 text-amber-600",
};

const SOURCE_LABELS: Record<SaleSource, string> = {
  paymob: "أونلاين",
  cash: "كاش",
  code: "كود",
};

const STATUS_STYLES: Record<SaleStatus, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  revoked: "border-red-500/30 bg-red-500/10 text-red-600",
};

const STATUS_LABELS: Record<SaleStatus, string> = {
  active: "نشط",
  revoked: "ملغي",
};

const BADGE_CLASSES =
  "inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-bold";

/** How the money arrived: the payment gateway, cash in person, or a prepaid code. */
export function SaleSourceBadge({ source }: { source: SaleSource }) {
  return (
    <span className={`${BADGE_CLASSES} ${SOURCE_STYLES[source]}`}>
      {SOURCE_LABELS[source]}
    </span>
  );
}

/** Whether the student still has the access this sale paid for. */
export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  return (
    <span className={`${BADGE_CLASSES} ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
