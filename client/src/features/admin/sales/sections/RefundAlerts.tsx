"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { adminPaymentsApi, isApiError, type RefundAlert } from "@/api";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import { formatEgp } from "@/shared/lib/money";

const REASONS: Record<RefundAlert["reason"], { title: string; text: string }> = {
  duplicate: {
    title: "دفع مرتين لنفس الكورس",
    text: "الكورس كان مفتوح عنده قبل الدفعة دي، فاتخصم منه مرتين.",
  },
  revoked_course: {
    title: "دفع بعد ما الكورس اتسحب منه",
    text: "سحبت منه الكورس بعد ما بدأ الدفع، فالكورس ماتفتحلوش. رجّعله فلوسه — أو لو هيكمّل، افتحله الكورس من صفحته.",
  },
};

const METHODS: Record<RefundAlert["method"], string> = {
  card: "كارت بنكي",
  wallet: "محفظة إلكترونية",
};

/** "١٤ سبتمبر ٢٠٢٦، ٩:٣٠ م" — the time helps spot it in Paymob's list. */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("اتنسخ رقم العملية");
  } catch {
    toast.error("المتصفح مسمحش بالنسخ — انسخ يدوي.");
  }
}

/**
 * دفعات محتاجة استرجاع: students charged without getting a new course (paid
 * twice, or paid for a course taken back after the payment started). The
 * teacher refunds each from Paymob's dashboard, then marks it dealt with.
 * Shows nothing at all while there are none.
 */
export function RefundAlerts() {
  const confirm = useConfirm();
  const [items, setItems] = useState<RefundAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminPaymentsApi
      .refundAlerts()
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      // The sales report works without it; the box just stays hidden.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  async function resolve(alert: RefundAlert) {
    const ok = await confirm({
      title: "الدفعة دي اتحلّت؟",
      message:
        "دوس «اتحلّت» بعد ما ترجّع الفلوس للطالب من لوحة Paymob (أو تفتحله الكورس). الدفعة هتتشال من القايمة.",
      confirmLabel: "اتحلّت",
    });
    if (!ok) return;
    setResolving(alert.id);
    try {
      await adminPaymentsApi.resolveRefundAlert(alert.id);
      setItems((prev) => prev.filter((a) => a.id !== alert.id));
      setTotal((n) => Math.max(0, n - 1));
      toast.success("تمام، اتشالت من القايمة");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    } finally {
      setResolving(null);
    }
  }

  return (
    <section
      aria-labelledby="refund-alerts-title"
      className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 sm:p-5"
    >
      <h2
        id="refund-alerts-title"
        className="text-base font-extrabold text-amber-700 dark:text-amber-400"
      >
        ⚠️ دفعات محتاجة استرجاع ({total.toLocaleString("ar-EG")})
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        طلاب اتخصم منهم فلوس من غير ما ياخدوا كورس جديد. رجّع لكل واحد المبلغ
        من لوحة Paymob (دوّر برقم العملية)، وبعدين دوس «اتحلّت».
      </p>

      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {items.map((alert) => {
          const reason = REASONS[alert.reason];
          const reference = alert.paymobTransactionId ?? alert.paymobOrderId;
          return (
            <li
              key={alert.id}
              className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-foreground">
                    {reason.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {reason.text}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-foreground">
                  {formatEgp(alert.amount)}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">الطالب</dt>
                <dd className="min-w-0 truncate">
                  {alert.student ? (
                    <>
                      <Link
                        href={`/admin/students/${alert.student.id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {alert.student.name}
                      </Link>{" "}
                      <span dir="ltr" className="font-mono text-muted-foreground">
                        {alert.student.studentPhone}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">طالب محذوف</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">الكورس</dt>
                <dd className="min-w-0 truncate">
                  {alert.course?.title ?? "كورس محذوف"}
                </dd>
                <dt className="text-muted-foreground">طريقة الدفع</dt>
                <dd>{METHODS[alert.method]}</dd>
                {alert.paidAt && (
                  <>
                    <dt className="text-muted-foreground">وقت الدفع</dt>
                    <dd>{formatDateTime(alert.paidAt)}</dd>
                  </>
                )}
                {reference && (
                  <>
                    <dt className="text-muted-foreground">رقم العملية</dt>
                    <dd className="flex items-center gap-2">
                      <span dir="ltr" className="font-mono">
                        {reference}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyText(reference)}
                        className="rounded-lg border border-border px-2 py-0.5 text-[11px] font-bold text-muted-foreground transition hover:bg-muted"
                      >
                        نسخ
                      </button>
                    </dd>
                  </>
                )}
              </dl>

              <div className="mt-auto flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => void resolve(alert)}
                  disabled={resolving === alert.id}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {resolving === alert.id ? "جارٍ..." : "اتحلّت ✓"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {total > items.length && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          ظاهر أحدث {items.length.toLocaleString("ar-EG")} — الباقي هيظهر لما
          تخلّص دول.
        </p>
      )}
    </section>
  );
}
