"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { coursesApi, paymentsApi, isApiError } from "@/api";
import type { CourseDetailResponse } from "@/api/types";
import { useAuth } from "@/features/auth/AuthContext";
import { SiteHeader } from "@/shared/components/SiteHeader";
import { SiteFooter } from "@/shared/components/SiteFooter";
import { StageBadge } from "@/shared/ui/StageBadge";
import { getLessonGradient } from "@/shared/lib/stage";
import { resolveAssetUrl } from "@/config/env";
import { BioIcon, CoverArt, PageBackdrop } from "@/shared/components/bio";
import { BtnNucleus } from "@/shared/ui/Button";
import { RedeemCodeForm } from "./components/RedeemCodeForm";
import { useSiteSettings } from "@/shared/site-settings";
import { WELCOME_PARAM } from "./welcome";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

// Shown only right after a course opens — fetched then, not with the page.
const CourseWelcomeDialog = dynamic(
  () =>
    import("./components/CourseWelcomeDialog").then(
      (m) => m.CourseWelcomeDialog,
    ),
  { ssr: false },
);

/** One of the teacher's motivating lines, or none when they cleared them. */
const pickLine = (lines: string[]) =>
  lines.length ? lines[Math.floor(Math.random() * lines.length)] : null;

export function CourseDetailView({
  slug,
  initialData = null,
}: {
  slug: string;
  /** The guest view rendered on the server (SEO); refreshed for the student. */
  initialData?: CourseDetailResponse | null;
}) {
  const { user, isAuthenticated, isLoading: authLoading, refresh } = useAuth();
  const [data, setData] = useState<CourseDetailResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [notFound, setNotFound] = useState(false);
  const [buying, setBuying] = useState(false);
  // True once the data reflects THIS visitor (owned, pending payment) — until
  // then the buy area waits, so an owner never sees "buy" flash first.
  const [personal, setPersonal] = useState(false);

  const load = useCallback(async () => {
    setNotFound(false);
    try {
      const res = await coursesApi.getBySlug(slug);
      setData(res);
      setPersonal(true);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Course detail is public — load it for guests and logged-in students alike.
  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, isAuthenticated, load]);

  // The welcome popup: asked for by ?welcome=1 (after paying / a code) and
  // shown once the course is really this student's; or right after opening
  // a free course or a code here.
  const wantsWelcome = useRef(false);
  const { welcome: welcomeTexts } = useSiteSettings();
  // The popup: mounted (and its code fetched) the first time it's needed.
  const [welcome, setWelcome] = useState<{ line: string | null } | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const greet = useCallback(() => {
    setWelcome({ line: pickLine(welcomeTexts.lines) });
    setWelcomeOpen(true);
  }, [welcomeTexts.lines]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has(WELCOME_PARAM)) return;
    wantsWelcome.current = true;
    params.delete(WELCOME_PARAM);
    const rest = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (rest ? `?${rest}` : ""),
    );
  }, []);

  useEffect(() => {
    if (wantsWelcome.current && personal && data?.owned) {
      wantsWelcome.current = false;
      greet();
    }
  }, [personal, data?.owned, greet]);

  /** A free course opens right here, no checkout. */
  const openFree = useCallback(async () => {
    if (!data || buying) return;
    setBuying(true);
    try {
      const result = await paymentsApi.checkout(data.course._id);
      if (result.free) {
        await Promise.all([load(), refresh()]);
        greet();
        return;
      }
      toast.error("معلش، حصلت مشكلة وإحنا بنفتح الكورس. حاول تاني.");
    } catch (err) {
      toast.error(
        isApiError(err)
          ? err.message
          : "معلش، حصلت مشكلة وإحنا بنفتح الكورس. حاول تاني.",
      );
    } finally {
      setBuying(false);
    }
  }, [data, buying, load, refresh, greet]);

  const gradient = data
    ? getLessonGradient(data.course.stage, data.course.thumbnailGradient)
    : "";
  const thumb = data ? resolveAssetUrl(data.course.thumbnail) : null;

  // Buy-area state: guests are sent to login, wrong-stage students see a note.
  const stageMismatch = !!data && !!user && user.stage !== data.course.stage;

  function renderBuyArea() {
    if (!data) return null;
    if (!personal && (authLoading || isAuthenticated)) {
      return (
        <span
          aria-hidden
          className="h-10 w-36 animate-pulse rounded-xl bg-muted/70"
        />
      );
    }
    if (data.owned) {
      return (
        <span className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
          مشترك ✓
        </span>
      );
    }
    if (!isAuthenticated) {
      return (
        <Link href="/login" className="btn btn-primary">
          <BtnNucleus />
          {data.course.price > 0
            ? "سجّل دخول للشراء"
            : "سجّل دخول عشان تفتح الكورس"}
        </Link>
      );
    }
    if (stageMismatch) {
      return (
        <span className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-700">
          الكورس ده مخصص لمرحلة تانية
        </span>
      );
    }
    if (data.course.price > 0) {
      return (
        <Link
          href={`/checkout/${data.course.slug}`}
          className="btn btn-primary"
        >
          <BtnNucleus />
          اشترِ الكورس
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={openFree}
        disabled={buying}
        className="btn btn-primary"
      >
        <BtnNucleus />
        {buying ? "لحظة..." : "افتح الكورس مجاناً"}
      </button>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="relative flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <PageBackdrop />
        <div className="mx-auto max-w-4xl">
          {loading ? (
            <LoadingScreen variant="page" />
          ) : notFound || !data ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                الكورس ده مش موجود.
              </p>
              <Link href="/courses" className="btn btn-secondary mt-4">
                رجوع للكورسات
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Hero */}
              <div className="group overflow-hidden rounded-3xl border border-border bg-card shadow-elegant">
                <div
                  className="relative flex aspect-video items-center justify-center overflow-hidden sm:aspect-21/9"
                  style={{ background: gradient }}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={data.course.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <CoverArt
                      seed={data.course.slug}
                      glyphClassName="size-32 sm:size-44"
                    />
                  )}
                  <div
                    className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent"
                    aria-hidden
                  />
                  <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold text-white">
                    <BioIcon
                      name="book"
                      className="size-3.5"
                      strokeWidth={2.5}
                    />
                    {data.lessons.length} درس
                  </span>
                </div>
                <div className="space-y-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <StageBadge stage={data.course.stage} />
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-extrabold text-primary">
                        {data.course.price > 0
                          ? `${data.course.price} ج.م`
                          : "مجاني"}
                      </span>
                    </div>
                    {renderBuyArea()}
                  </div>
                  {/* Prepaid code: only when the student could actually use one here. */}
                  {personal &&
                    !data.owned &&
                    isAuthenticated &&
                    !stageMismatch &&
                    data.course.price > 0 && (
                      <div className="flex justify-end">
                        <RedeemCodeForm
                          courseId={data.course._id}
                          className="sm:max-w-sm"
                          onRedeemed={async () => {
                            await Promise.all([load(), refresh()]);
                            greet();
                          }}
                        />
                      </div>
                    )}
                  <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
                    {data.course.title}
                  </h1>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {data.course.longDescription}
                  </p>
                </div>
              </div>

              {/* Lessons */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
                <h2 className="mb-4 text-lg font-extrabold text-foreground">
                  دروس الكورس ({data.lessons.length})
                </h2>
                {data.lessons.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-background py-8 text-center text-xs text-muted-foreground">
                    لسه مفيش دروس في الكورس ده.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.lessons.map((lesson, i) => {
                      const inner = (
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-foreground">
                              {lesson.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {lesson.durationMinutes} دقيقة
                            </p>
                          </div>
                          {lesson.locked ? (
                            <span
                              className="text-muted-foreground"
                              aria-label="مقفول"
                            >
                              🔒
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-primary">
                              مشاهدة ←
                            </span>
                          )}
                        </div>
                      );
                      return (
                        <li key={lesson._id}>
                          {lesson.locked ? (
                            <div className="cursor-not-allowed rounded-xl border border-border bg-background p-3 opacity-70">
                              {inner}
                            </div>
                          ) : (
                            <Link
                              href={`/player/${lesson.slug}`}
                              className="block rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/50 hover:bg-muted"
                            >
                              {inner}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!data.owned &&
                  (personal || (!authLoading && !isAuthenticated)) &&
                  data.lessons.length > 0 && (
                    <p className="mt-4 text-center text-xs text-muted-foreground">
                      {isAuthenticated
                        ? "اشترِ الكورس عشان تفتح كل الدروس."
                        : "سجّل دخول واشترِ الكورس عشان تفتح كل الدروس."}
                    </p>
                  )}
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
      {data && welcome && (
        <CourseWelcomeDialog
          open={welcomeOpen}
          firstName={user?.firstName}
          courseTitle={data.course.title}
          line={welcome.line}
          firstLessonSlug={data.lessons[0]?.slug}
          onClose={() => setWelcomeOpen(false)}
        />
      )}
    </div>
  );
}
