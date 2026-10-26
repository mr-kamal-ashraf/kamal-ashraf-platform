"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { coursesApi, paymentsApi, isApiError } from "@/api";
import type {
  CourseDetailResponse,
  KioskReference,
  PaymentMethod,
} from "@/api/types";
import { useAuth } from "@/features/auth/AuthContext";
import { RedeemCodeForm } from "@/features/courses/components/RedeemCodeForm";
import { welcomeHref } from "@/features/courses/welcome";
import { SiteHeader } from "@/shared/components/SiteHeader";
import { SiteFooter } from "@/shared/components/SiteFooter";
import { BioIcon, CoverArt, PageBackdrop } from "@/shared/components/bio";
import { StageBadge } from "@/shared/ui/StageBadge";
import { BtnNucleus } from "@/shared/ui/Button";
import { getLessonGradient } from "@/shared/lib/stage";
import { cn } from "@/shared/lib/cn";
import { resolveAssetUrl } from "@/config/env";
import { isOptimizable } from "@/shared/lib/images";
import {
  CardPaymentForm,
  type CardCheckout,
} from "./components/CardPaymentForm";
import { KioskReferenceCard } from "./components/KioskReferenceCard";
import { EG_PHONE, PAYMENT_METHODS } from "./methods";
import { loadPixel } from "./pixel";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

const START_FAILED = "معلش، حصلت مشكلة وإحنا بنبدأ الدفع. حاول تاني.";

/**
 * /checkout/[slug] — the student's own checkout page: the course summary, the
 * ways to pay, and the chosen one right here — Paymob's card fields in the
 * platform's style, the wallet number, or a cash reference (Aman / Masary),
 * which this page keeps checking until it's paid. Paying lands on the
 * course with a welcome.
 */
export function CheckoutView({ slug }: { slug: string }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "ready" | "notFound">(
    "loading",
  );
  const [data, setData] = useState<CourseDetailResponse | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [cardEmbedded, setCardEmbedded] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  const [card, setCard] = useState<CardCheckout | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [kiosk, setKiosk] = useState<KioskReference | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The server found an earlier payment of theirs that went through (its
   * confirmation was late) and opened the course with it — no second charge.
   */
  const openedAlready = useCallback(
    (err: unknown) => {
      if (!isApiError(err) || err.code !== "ALREADY_OWNED") return false;
      router.replace(welcomeHref(slug));
      return true;
    },
    [router, slug],
  );

  /** Card fields in the page: a payment intention for this course. */
  const startCard = useCallback(
    async (courseId: string) => {
      setCardBusy(true);
      setCardError(null);
      setCard(null);
      try {
        const res = await paymentsApi.checkout(courseId, { method: "card" });
        if (res.pixel && res.merchantOrderId) {
          setCard({ ...res.pixel, merchantOrderId: res.merchantOrderId });
        } else if (res.iframeUrl) {
          window.location.href = res.iframeUrl;
        } else {
          setCardError(START_FAILED);
        }
      } catch (err) {
        if (openedAlready(err)) return;
        setCardError(isApiError(err) ? err.message : START_FAILED);
      } finally {
        setCardBusy(false);
      }
    },
    [openedAlready],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    void Promise.all([
      coursesApi.getBySlug(slug),
      paymentsApi
        .methods()
        .catch(() => ({ methods: [] as PaymentMethod[], cardEmbedded: false })),
    ])
      .then(([course, available]) => {
        if (cancelled) return;
        // Nothing to pay: owned already, or free (opened from the course page).
        if (course.owned || course.course.price <= 0) {
          router.replace(`/courses/${slug}`);
          return;
        }
        // A cash reference they already have opens straight to it, so they
        // pay that one instead of starting a second payment.
        const pending = course.pendingKiosk ?? null;
        const first =
          pending && available.methods.includes("kiosk")
            ? "kiosk"
            : (available.methods[0] ?? null);
        setData(course);
        setMethods(available.methods);
        setCardEmbedded(!!available.cardEmbedded);
        setKiosk(pending);
        setMethod(first);
        setStatus("ready");
        if (first === "card" && available.cardEmbedded) {
          loadPixel().catch(() => undefined);
          void startCard(course.course._id);
        }
      })
      .catch(() => !cancelled && setStatus("notFound"));
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, slug, router, startCard]);

  function choose(next: PaymentMethod) {
    setMethod(next);
    setError(null);
    if (next === "card" && cardEmbedded && data && !card && !cardBusy) {
      loadPixel().catch(() => undefined);
      void startCard(data.course._id);
    }
  }

  const walletPhone = phone ?? user?.studentPhone ?? "";

  /** Wallet / kiosk / Paymob's own card page: starts checkout and follows it. */
  async function start(chosen: PaymentMethod) {
    if (!data || busy) return;
    if (chosen === "wallet" && !EG_PHONE.test(walletPhone.trim())) {
      setError("رقم المحفظة لازم يكون ١١ رقم ويبدأ بـ 01.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const checkout = () =>
        paymentsApi.checkout(data.course._id, {
          method: chosen,
          walletPhone: chosen === "wallet" ? walletPhone.trim() : undefined,
        });
      let res;
      // A reference another tab is getting right now: wait a moment for it.
      for (let attempt = 0; ; attempt++) {
        try {
          res = await checkout();
          break;
        } catch (err) {
          if (!isApiError(err) || err.code !== "KIOSK_PREPARING" || attempt >= 3) throw err;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      const url = res.redirectUrl ?? res.iframeUrl;
      if (url) {
        window.location.href = url;
        return;
      }
      if (res.kiosk) {
        setKiosk(res.kiosk);
        return;
      }
      setError(START_FAILED);
    } catch (err) {
      if (openedAlready(err)) return;
      setError(isApiError(err) ? err.message : START_FAILED);
    } finally {
      setBusy(false);
    }
  }

  const stageMismatch = !!data && !!user && user.stage !== data.course.stage;

  function renderBody() {
    if (authLoading || status === "loading") return <LoadingScreen variant="page" />;
    if (!isAuthenticated) {
      return (
        <Notice
          title="سجّل دخول الأول"
          text="عشان تشتري الكورس لازم تكون داخل بحسابك."
        >
          <Link href="/login" className="btn btn-primary">
            <BtnNucleus />
            تسجيل الدخول
          </Link>
          <Link href="/register" className="btn btn-secondary">
            إنشاء حساب
          </Link>
        </Notice>
      );
    }
    if (status === "notFound" || !data) {
      return (
        <Notice
          title="الكورس ده مش موجود"
          text="ممكن يكون اتشال أو اللينك غلط."
        >
          <Link href="/courses" className="btn btn-secondary">
            رجوع للكورسات
          </Link>
        </Notice>
      );
    }
    if (stageMismatch) {
      return (
        <Notice
          title="الكورس ده لمرحلة تانية"
          text="تقدر تشتري كورسات مرحلتك بس."
        >
          <Link href="/courses" className="btn btn-secondary">
            كورسات مرحلتك
          </Link>
        </Notice>
      );
    }

    const amount = data.course.price;
    // The course on top, the payment under it — both the page's full width.
    return (
      <div className="space-y-5">
        <OrderSummary data={data} />

        <div className="space-y-4">
          <section className="card-strata relative rounded-3xl p-5 sm:p-7 lg:p-8">

            {methods.length === 0 ? (
              <p className="py-6 text-center text-sm font-semibold text-muted-foreground">
                الدفع الأونلاين مش متاح دلوقتي. تقدر تفتح الكورس بكود، أو تواصل
                معانا.
              </p>
            ) : (
              <>
                {methods.length > 1 && (
                  <>
                    <StepTitle n={1}>اختار طريقة الدفع</StepTitle>
                    {/* Side by side once the box is wide enough. */}
                    <div
                      role="radiogroup"
                      aria-label="طريقة الدفع"
                      className="mt-4 grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] sm:gap-3"
                    >
                      {methods.map((m) => (
                        <MethodOption
                          key={m}
                          method={m}
                          selected={m === method}
                          disabled={busy}
                          onSelect={() => choose(m)}
                        />
                      ))}
                    </div>
                    <div className="my-6 border-t border-dashed border-border" />
                  </>
                )}

                {kiosk && method !== "kiosk" && (
                  <p
                    role="note"
                    className="mb-5 rounded-xl border border-highlight/30 bg-highlight/8 px-4 py-3 text-xs font-semibold leading-relaxed text-foreground"
                  >
                    عندك رقم دفع كاش مستني (
                    <span dir="ltr" className="font-extrabold">
                      {kiosk.reference}
                    </span>
                    ) — لو هتدفع بطريقة تانية، متدفعش الرقم ده عشان متدفعش
                    مرتين.
                  </p>
                )}

                {method === "card" && (
                  <>
                    <StepTitle n={methods.length > 1 ? 2 : undefined}>
                      بيانات الكارت
                    </StepTitle>
                    <div className="mt-4">
                      {!cardEmbedded ? (
                        <PayButton
                          busy={busy}
                          onClick={() => void start("card")}
                          label={`ادفع ${amount} ج.م بالكارت`}
                        />
                      ) : card ? (
                        <CardPaymentForm
                          key={card.clientSecret}
                          checkout={card}
                          amount={amount}
                          onRestart={() => void startCard(data.course._id)}
                        />
                      ) : cardError ? (
                        <div
                          role="alert"
                          className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-center"
                        >
                          <p className="text-sm font-semibold text-destructive">
                            {cardError}
                          </p>
                          <button
                            type="button"
                            onClick={() => void startCard(data.course._id)}
                            className="btn btn-secondary mt-3"
                          >
                            جرّب تاني
                          </button>
                        </div>
                      ) : (
                        <div
                          aria-hidden
                          className="h-30 animate-pulse rounded-xl border border-border bg-background"
                        />
                      )}
                    </div>
                  </>
                )}

                {method === "wallet" && (
                  <>
                    <StepTitle n={methods.length > 1 ? 2 : undefined}>
                      رقم المحفظة
                    </StepTitle>
                    <label
                      htmlFor="wallet-phone"
                      className="mt-4 block text-sm font-bold text-foreground"
                    >
                      رقم المحفظة اللي هتدفع منها
                    </label>
                    <input
                      id="wallet-phone"
                      type="tel"
                      dir="ltr"
                      inputMode="tel"
                      autoComplete="tel"
                      value={walletPhone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setError(null);
                      }}
                      placeholder="01xxxxxxxxx"
                      className="mt-1.5 min-h-12 w-full rounded-xl border border-border bg-background px-3 text-center text-lg font-bold tracking-wider focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      هتتحوّل لصفحة المحفظة تأكد الدفع بالرقم السري بتاعها.
                    </p>
                    <PayButton
                      busy={busy}
                      onClick={() => void start("wallet")}
                      label={`ادفع ${amount} ج.م`}
                    />
                  </>
                )}

                {method === "kiosk" && (
                  <>
                    <StepTitle n={methods.length > 1 ? 2 : undefined}>
                      الدفع كاش
                    </StepTitle>
                    <div className="mt-4">
                      {kiosk ? (
                        <KioskReferenceCard
                          reference={kiosk}
                          courseSlug={slug}
                          onPaid={(paidSlug) =>
                            router.replace(welcomeHref(paidSlug ?? slug))
                          }
                          onRenew={() => void start("kiosk")}
                          renewing={busy}
                        />
                      ) : (
                        <>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            هتاخد رقم دفع، وتدفع بيه كاش في أي محل عليه علامة
                            أمان أو مصاري. الكورس بيتفتحلك تلقائي أول ما تدفع،
                            والرقم هيوصلك كمان على الواتساب.
                          </p>
                          <PayButton
                            busy={busy}
                            onClick={() => void start("kiosk")}
                            label={`اطلع رقم الدفع (${amount} ج.م)`}
                          />
                        </>
                      )}
                    </div>
                  </>
                )}

                {error && (
                  <p
                    role="alert"
                    className="mt-3 text-sm font-semibold text-destructive"
                  >
                    {error}
                  </p>
                )}
              </>
            )}
          </section>

          <div className="rounded-2xl border border-dashed border-border bg-card/70 px-5 py-4">
            <RedeemCodeForm
              courseId={data.course._id}
              onRedeemed={(course) => router.push(welcomeHref(course.slug))}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="relative flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <PageBackdrop />
        <div className="relative mx-auto max-w-5xl">
          <Link
            href={`/courses/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
          >
            <span aria-hidden>→</span>
            رجوع لصفحة الكورس
          </Link>
          <h1 className="mt-3 text-2xl font-extrabold text-foreground sm:text-3xl">
            إتمام الشراء
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            خطوة واحدة والكورس يبقى بتاعك ✨
          </p>
          <div className="mt-6">{renderBody()}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * The course being bought, as a wide card above the payment: the cover on
 * one side, the course in the middle, and the total on the other side (under
 * the course on phones, where it stays compact so the payment isn't pushed
 * far down).
 */
function OrderSummary({ data }: { data: CourseDetailResponse }) {
  const { course, lessons } = data;
  const thumb = resolveAssetUrl(course.thumbnail);
  const minutes = lessons.reduce((sum, l) => sum + l.durationMinutes, 0);

  return (
    <section
      aria-label="الكورس اللي هتشتريه"
      className="card-strata overflow-hidden rounded-3xl"
    >
      <div className="flex items-stretch gap-4 p-4 sm:gap-6 sm:p-5">
        <div
          className="relative flex aspect-video w-28 shrink-0 items-center justify-center self-center overflow-hidden rounded-xl sm:w-52 sm:rounded-2xl lg:w-64"
          style={{
            background: getLessonGradient(course.stage, course.thumbnailGradient),
          }}
        >
          {thumb ? (
            <Image
              src={thumb}
              alt=""
              fill
              sizes="(min-width: 1024px) 256px, (min-width: 640px) 208px, 112px"
              unoptimized={!isOptimizable(thumb)}
              className="object-cover"
            />
          ) : (
            <CoverArt seed={course.slug} glyphClassName="size-12 sm:size-20" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="min-w-0">
            <StageBadge stage={course.stage} />
            <h2 className="mt-2 line-clamp-2 text-sm font-extrabold text-foreground sm:text-lg lg:text-xl">
              {course.title}
            </h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
              <BioIcon name="book" className="size-3.5" strokeWidth={2.5} />
              {lessons.length} درس
              {minutes > 0 && <> · {minutes} دقيقة شرح</>}
            </p>
            <p className="mt-2 text-base font-extrabold text-primary sm:hidden">
              {course.price} ج.م
            </p>
          </div>

          <div className="hidden shrink-0 rounded-2xl border border-dashed border-border bg-background/60 px-5 py-4 sm:block md:w-64">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>سعر الكورس</span>
              <span>{course.price} ج.م</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-border pt-2.5">
              <span className="text-sm font-extrabold text-foreground">الإجمالي</span>
              <span className="text-xl font-extrabold text-primary">
                {course.price} ج.م
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="hidden items-center gap-2 border-t border-border bg-primary/5 px-5 py-2.5 text-xs font-semibold text-foreground sm:flex">
        <BioIcon name="spark" className="size-4 shrink-0 text-primary" />
        الكورس بيتفتحلك تلقائي أول ما الدفع يتم.
      </p>
    </section>
  );
}

function StepTitle({ n, children }: { n?: number; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-base font-extrabold text-foreground sm:text-lg">
      {n !== undefined && (
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
          {n}
        </span>
      )}
      {children}
    </h2>
  );
}

function MethodOption({
  method,
  selected,
  disabled,
  onSelect,
}: {
  method: PaymentMethod;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const info = PAYMENT_METHODS[method];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-start transition-colors disabled:opacity-60",
        selected
          ? "border-primary bg-primary/8"
          : "border-border bg-background hover:border-primary/40",
      )}
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl"
        aria-hidden
      >
        {info.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-foreground">
          {info.title}
        </span>
        <span className="block text-xs text-muted-foreground">{info.hint}</span>
      </span>
      <span
        className={cn(
          "size-5 shrink-0 rounded-full border-2",
          selected
            ? "border-primary bg-primary shadow-[inset_0_0_0_3px_var(--card)]"
            : "border-border",
        )}
        aria-hidden
      />
    </button>
  );
}

function PayButton({
  busy,
  label,
  onClick,
}: {
  busy: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="btn btn-primary mt-5 w-full"
    >
      <BtnNucleus />
      {busy ? "لحظة..." : label}
    </button>
  );
}

function Notice({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
      <p className="text-lg font-extrabold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}

