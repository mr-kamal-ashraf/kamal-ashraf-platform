"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { paymentsApi } from "@/api";
import type { KioskReference } from "@/api/types";
import { BtnNucleus } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/cn";

/** "الخميس ٢٧ أكتوبر، ٩:٣٠ م" — Egypt's time, whatever the device's zone. */
const DEADLINE = new Intl.DateTimeFormat("ar-EG", {
  timeZone: "Africa/Cairo",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Checking for the payment while the page is open: often at first (the
 * student may pay right away), then once a minute, and not past half an hour
 * — plus whenever they come back to the tab. The server only asks Paymob when
 * it hasn't recently, and the webhook opens the course regardless.
 */
const FAST_EVERY_MS = 15_000;
const FAST_FOR_MS = 2 * 60_000;
const SLOW_EVERY_MS = 60_000;
const WATCH_FOR_MS = 30 * 60_000;

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

/** Watches the reference until it's paid, then hands over the course slug. */
function useWatchPayment(
  merchantOrderId: string,
  enabled: boolean,
  onPaid: (courseSlug: string | null) => void,
) {
  const [checking, setChecking] = useState(false);
  const paidRef = useRef(onPaid);
  useEffect(() => {
    paidRef.current = onPaid;
  });

  const check = useCallback(
    async (manual = false) => {
      setChecking(manual);
      try {
        const res = await paymentsApi.verify({ merchantOrderId });
        if (res.status === "paid") {
          paidRef.current(res.courseSlug);
          return true;
        }
        if (manual) toast("لسه موصلناش الدفع — لو لسه دافع، استنى دقيقة وجرّب تاني.");
      } catch {
        if (manual) toast.error("مقدرناش نتأكد دلوقتي — جرّب تاني بعد شوية.");
      } finally {
        setChecking(false);
      }
      return false;
    },
    [merchantOrderId],
  );

  useEffect(() => {
    if (!enabled) return;
    const started = Date.now();
    let timer = 0;
    let stopped = false;
    const schedule = () => {
      const elapsed = Date.now() - started;
      if (stopped || elapsed > WATCH_FOR_MS) return;
      timer = window.setTimeout(
        async () => {
          if (document.visibilityState === "visible" && (await check())) return;
          schedule();
        },
        elapsed < FAST_FOR_MS ? FAST_EVERY_MS : SLOW_EVERY_MS,
      );
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, check]);

  return { checking, checkNow: () => check(true) };
}

async function copy(reference: string) {
  try {
    await navigator.clipboard.writeText(reference);
    toast.success("اتنسخ رقم الدفع");
  } catch {
    toast.error("المتصفح مسمحش بالنسخ — اكتب الرقم يدوي.");
  }
}

const STEPS = [
  "روح أي محل عليه علامة أمان أو مصاري — سوبر ماركت، صيدلية، أو محل موبايلات.",
  "قول للبياع إنك عايز تدفع لـ «Paymob / Accept»، وإديله رقم الدفع.",
  "ادفع المبلغ كاش وخد الإيصال — والكورس هيتفتحلك تلقائي.",
];

/**
 * A cash reference to pay at an Aman / Masary outlet. On checkout
 * (`full`): the number, the amount, the deadline, how to pay, and a quiet
 * check that opens the course once it's paid. On the course page
 * (`compact`): the number and deadline with a link to the full instructions.
 * After the deadline it says so and offers a fresh number instead.
 */
export function KioskReferenceCard({
  reference,
  variant = "full",
  courseSlug,
  onPaid,
  onRenew,
  renewing = false,
}: {
  reference: KioskReference;
  variant?: "full" | "compact";
  courseSlug: string;
  onPaid?: (courseSlug: string | null) => void;
  onRenew?: () => void;
  renewing?: boolean;
}) {
  const now = useNow(30_000);
  const expiresAt = new Date(reference.expiresAt).getTime();
  const expired = now >= expiresAt;
  const hoursLeft = Math.max(0, Math.floor((expiresAt - now) / 3_600_000));
  const full = variant === "full";
  const { checking, checkNow } = useWatchPayment(
    reference.merchantOrderId,
    full && !expired && !!onPaid,
    (slug) => onPaid?.(slug),
  );

  if (expired) {
    return (
      <div className="rounded-2xl border border-border bg-background p-4 text-center">
        <p className="text-sm font-extrabold text-foreground">رقم الدفع ده انتهى</p>
        <p className="mt-1 text-xs text-muted-foreground">
          متدفعهوش — اطلع رقم جديد وادفع بيه.
        </p>
        {full && onRenew ? (
          <button
            type="button"
            onClick={onRenew}
            disabled={renewing}
            className="btn btn-primary mt-3"
          >
            <BtnNucleus />
            {renewing ? "لحظة..." : "اطلع رقم جديد"}
          </button>
        ) : (
          <Link href={`/checkout/${courseSlug}`} className="btn btn-secondary mt-3">
            اطلع رقم جديد
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5",
        full ? "p-5" : "p-4",
      )}
    >
      <p className="text-center text-xs font-bold text-muted-foreground">
        {full ? "رقم الدفع بتاعك" : "عندك رقم دفع مستني — ادفعه في أي محل أمان أو مصاري"}
      </p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <span
          dir="ltr"
          className="select-all text-3xl font-black tracking-[0.2em] text-foreground tabular-nums sm:text-4xl"
        >
          {reference.reference}
        </span>
        <button
          type="button"
          onClick={() => void copy(reference.reference)}
          aria-label="انسخ رقم الدفع"
          className="btn btn-secondary btn-sm btn-icon"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        <span className="font-extrabold text-primary">{reference.amount} ج.م</span>
        <span className="text-muted-foreground">
          ادفع قبل {DEADLINE.format(expiresAt)}
          {hoursLeft < 24 && ` (فاضل ${hoursLeft < 1 ? "أقل من ساعة" : `${hoursLeft} ساعة`})`}
        </span>
      </div>

      {full ? (
        <>
          <ol className="mt-5 space-y-2.5">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-2.5 text-sm text-foreground">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <ul className="mt-4 space-y-1 border-t border-dashed border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            <li>• الرقم وصلك كمان على الواتساب، عشان ميضيعش منك.</li>
            <li>• الرقم ده للكورس ده بس، وبالمبلغ ده بالظبط.</li>
            <li>• لو دفعت بطريقة تانية، متدفعش الرقم ده — عشان متدفعش مرتين.</li>
          </ul>
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-card px-3 py-3 text-center">
            <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden />
              مستنيين الدفع — أول ما تدفع، الكورس هيتفتحلك هنا وهيوصلك واتساب.
            </p>
            <button
              type="button"
              onClick={() => void checkNow()}
              disabled={checking}
              className="btn btn-secondary btn-sm"
            >
              {checking ? "بنتأكد..." : "دفعت؟ اتأكد دلوقتي"}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3 text-center">
          <Link href={`/checkout/${courseSlug}`} className="text-xs font-bold text-primary hover:underline">
            ازاي أدفع بالرقم ده؟
          </Link>
        </div>
      )}
    </div>
  );
}
