"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { paymentsApi } from "@/api";
import { welcomeHref } from "@/features/courses/welcome";
import { useAuth } from "@/features/auth/AuthContext";
import { SiteHeader } from "@/shared/components/SiteHeader";
import { SiteFooter } from "@/shared/components/SiteFooter";
import { PageBackdrop } from "@/shared/components/bio";
import { BtnNucleus } from "@/shared/ui/Button";

type Result = "checking" | "opened" | "success" | "failed" | "unknown";

/** How often, and how many times, to re-check a payment Paymob hasn't settled yet. */
const RETRY_EVERY_MS = 6000;
const MAX_CHECKS = 6;

/**
 * Paymob sends the student back here after paying. The course is opened by
 * the server — from Paymob's webhook, or right here: we ask the server to
 * check the order with Paymob (the safety net when the webhook is late or
 * can't reach us), and keep checking for a little while if it's still
 * settling. Once it's open, the student goes straight to the course, where
 * a welcome waits.
 */
export function PaymentCallbackView() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [result, setResult] = useState<Result>("checking");
  const [courseSlug, setCourseSlug] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    const params = new URLSearchParams(window.location.search);
    // Paymob's verdict from the return URL — none while it's still pending.
    const success =
      params.get("pending") === "true" ? null : params.get("success");
    const merchantOrderId = params.get("merchant_order_id") ?? undefined;
    const paymobOrderId = params.get("order") ?? undefined;

    if (!isAuthenticated || (!merchantOrderId && !paymobOrderId)) {
      setResult(
        success === "false"
          ? "failed"
          : success === "true"
            ? "success"
            : "unknown",
      );
      return;
    }

    let cancelled = false;
    let checks = 0;
    let timer = 0;
    const check = async () => {
      checks += 1;
      try {
        const res = await paymentsApi.verify({
          merchantOrderId,
          paymobOrderId,
        });
        if (cancelled) return;
        setCourseSlug(res.courseSlug);
        if (res.status === "paid") {
          setResult("opened");
          if (res.courseSlug) router.replace(welcomeHref(res.courseSlug));
          return;
        }
        // Declined: one check is enough (it also tells us which course) —
        // unless Paymob just said "success" (a retry on the same order that
        // went through): then keep checking until our record catches up.
        if (
          (res.status === "failed" && success !== "true") ||
          success === "false"
        ) {
          return setResult("failed");
        }
      } catch {
        if (cancelled) return;
        if (success === "false") return setResult("failed");
      }
      if (checks < MAX_CHECKS) {
        timer = window.setTimeout(check, RETRY_EVERY_MS);
      } else {
        setResult(success === "true" ? "success" : "unknown");
      }
    };
    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authLoading, isAuthenticated, router]);

  const content = {
    checking: {
      emoji: "⏳",
      title: "بنتأكد من الدفع…",
      body: "لحظات وهنفتحلك الكورس — متقفلش الصفحة.",
      tone: "text-amber-600",
    },
    opened: {
      emoji: "✅",
      title: "تم الدفع والكورس اتفتح",
      body: "لحظة وهنوديك على الكورس…",
      tone: "text-emerald-600",
    },
    success: {
      emoji: "✅",
      title: "تم الدفع بنجاح",
      body: "الكورس بيتفتحلك دلوقتي. لو ملقتوش مفتوح على طول، افتح صفحة الكورس وهيتفتح.",
      tone: "text-emerald-600",
    },
    failed: {
      emoji: "❌",
      title: "الدفع ماتمّش",
      body: "الدفع اتلغى أو مكملش. مفيش أي فلوس اتخصمت — تقدر تحاول تاني.",
      tone: "text-red-600",
    },
    unknown: {
      emoji: "⏳",
      title: "بنراجع حالة الدفع",
      body: "لو خصمت الفلوس، الكورس هيتفتحلك خلال لحظات. افتح صفحة الكورس وهيتفتح.",
      tone: "text-amber-600",
    },
  }[result];

  const courseHref = courseSlug ? `/courses/${courseSlug}` : "/courses";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="relative flex flex-1 items-center justify-center px-4 py-16">
        <PageBackdrop />
        <div className="card-strata relative w-full max-w-md overflow-hidden rounded-3xl p-8 text-center">
          <div className="relative mx-auto flex size-20 items-center justify-center rounded-full bg-primary/8 text-5xl">
            <span className="absolute inset-0 animate-ripple rounded-full border-2 border-primary/30" />
            {content.emoji}
          </div>
          <h1 className={`mt-4 text-2xl font-extrabold ${content.tone}`}>
            {content.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {content.body}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {result === "failed" && courseSlug ? (
              <Link
                href={`/checkout/${courseSlug}`}
                className="btn btn-primary"
              >
                <BtnNucleus />
                حاول تاني
              </Link>
            ) : (
              <Link
                href={
                  result === "opened" && courseSlug
                    ? welcomeHref(courseSlug)
                    : courseHref
                }
                className="btn btn-primary"
              >
                <BtnNucleus />
                {result === "opened" ? "ابدأ الكورس" : "صفحة الكورس"}
              </Link>
            )}
            <Link href="/" className="btn btn-secondary">
              الرئيسية
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
