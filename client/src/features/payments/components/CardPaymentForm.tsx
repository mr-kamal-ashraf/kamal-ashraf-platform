"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BtnNucleus } from "@/shared/ui/Button";
import {
  loadPixel,
  mountPixel,
  pixelStyle,
  submitPixelPayment,
  type PixelPayResponse,
} from "../pixel";

export interface CardCheckout {
  publicKey: string;
  clientSecret: string;
  merchantOrderId: string;
}

/** A payment that never answers (lost connection) frees the button after this. */
const PAY_TIMEOUT_MS = 90_000;

/**
 * Card payment inside our checkout: Paymob's card fields (Pixel) dressed in
 * the platform's style, paid with our own button. Cards that need the bank's
 * 3-D Secure check go to the bank's page and come back to the result page;
 * the others land there straight from here. Either way the result page
 * confirms with the server before the course opens.
 */
export function CardPaymentForm({
  checkout,
  amount,
  onRestart,
}: {
  checkout: CardCheckout;
  amount: number;
  /** A fresh checkout, when this one can't be paid anymore (expired / too many tries). */
  onRestart: () => void;
}) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [valid, setValid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<{ text: string; restart: boolean } | null>(
    null,
  );
  const timeout = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let unmount: (() => void) | undefined;
    const { publicKey, clientSecret, merchantOrderId } = checkout;

    const onResult = (res: PixelPayResponse) => {
      window.clearTimeout(timeout.current);
      const data = (
        res?.data && !Array.isArray(res.data) ? res.data : {}
      ) as Record<string, unknown>;
      const success = String(data.success) === "true";
      const pending = String(data.pending) === "true";
      if (res?.status === 200 && (success || pending)) {
        // Still settling (pending): no verdict in the URL — the result page
        // keeps checking with the server instead of calling it failed.
        router.push(
          `/payment/callback?merchant_order_id=${encodeURIComponent(merchantOrderId)}${success ? "&success=true" : ""}`,
        );
        return;
      }
      setPaying(false);
      setError(payError(res));
    };

    loadPixel()
      .then((Pixel) => {
        if (cancelled || !container.current) return;
        unmount = mountPixel(Pixel, container.current, {
          publicKey,
          clientSecret,
          paymentMethods: ["card"],
          disablePay: true,
          showSaveCard: false,
          // Paymob's "Powered by" footer only adds space under the fields.
          showPaymobLogo: false,
          cardValidationChanged: (isValid) => {
            setValid(isValid);
            if (isValid) setError((e) => (e?.restart ? e : null));
          },
          afterPaymentComplete: onResult,
          customStyle: pixelStyle(),
        });
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("failed"));

    return () => {
      cancelled = true;
      window.clearTimeout(timeout.current);
      unmount?.();
    };
  }, [checkout, attempt, router]);

  function pay() {
    if (!valid || paying) return;
    setError(null);
    setPaying(true);
    submitPixelPayment();
    timeout.current = window.setTimeout(() => {
      setPaying(false);
      setError({
        text: "الدفع اتأخر في الرد. اتأكد من النت وحاول تاني.",
        restart: false,
      });
    }, PAY_TIMEOUT_MS);
  }

  return (
    <div>
      <div className="relative">
        {status === "loading" && <FieldsSkeleton />}
        {status === "failed" ? (
          <div className="rounded-2xl border border-border bg-background p-4 text-center">
            <p className="text-sm font-semibold text-foreground">
              خانات الكارت ماحمّلتش. اتأكد من النت وجرّب تاني.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                setAttempt((n) => n + 1);
              }}
              className="btn btn-secondary mt-3"
            >
              جرّب تاني
            </button>
          </div>
        ) : (
          <div ref={container} aria-busy={status === "loading"} />
        )}
      </div>

      {/* Paymob's fields take Western digits only (٠١٢ are silently dropped)
          and the expiry is month-then-year — neither can be changed inside
          their frame, so say it here. */}
      {status === "ready" && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          اكتب الأرقام بالإنجليزي (<bdi>123</bdi>). وتاريخ الانتهاء: الشهر وبعدين
          السنة زي ما هو مكتوب على الكارت، مثلاً <bdi>09/29</bdi>.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3"
        >
          <p className="text-sm font-semibold text-destructive">{error.text}</p>
          {error.restart && (
            <button
              type="button"
              onClick={onRestart}
              className="text-sm font-bold text-primary hover:underline"
            >
              ابدأ من جديد
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={pay}
        disabled={status !== "ready" || !valid || paying || !!error?.restart}
        className="btn btn-primary mt-5 w-full"
      >
        <BtnNucleus />
        {paying ? "جارٍ الدفع..." : `ادفع ${amount} ج.م`}
      </button>
    </div>
  );
}

/** Placeholder in the shape of Paymob's card box while its fields load. */
function FieldsSkeleton() {
  return (
    <div
      aria-hidden
      className="flex h-30 animate-pulse flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-background"
    >
      <div className="flex-1" />
      <div className="flex flex-1 divide-x divide-border">
        <div className="flex-1" />
        <div className="flex-1" />
      </div>
      <div className="flex-1" />
    </div>
  );
}

/** Paymob's answer to a card that didn't go through, in the student's words. */
function payError(res: PixelPayResponse): { text: string; restart: boolean } {
  const text = JSON.stringify(res?.data ?? "");
  if (!res?.status) {
    return {
      text: "الاتصال اتقطع قبل ما الدفع يكمل. اتأكد من النت وحاول تاني.",
      restart: false,
    };
  }
  if (res.status >= 500) {
    return {
      text: "بوابة الدفع مش بترد دلوقتي. حاول تاني بعد شوية.",
      restart: false,
    };
  }
  if (res.status === 401) {
    return { text: "مهلة الدفع خلصت.", restart: true };
  }
  if (res.status === 403 || /Retry limit/i.test(text)) {
    return { text: "حاولت كذا مرة بنفس الطلب.", restart: true };
  }
  if (/already paid/i.test(text)) {
    return {
      text: "الطلب ده اتدفع خلاص — افتح صفحة الكورس.",
      restart: false,
    };
  }
  return {
    text: "البنك رفض العملية. اتأكد من بيانات الكارت والرصيد، أو جرّب كارت تاني.",
    restart: false,
  };
}
