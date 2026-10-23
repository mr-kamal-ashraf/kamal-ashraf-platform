"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { coursesApi, isApiError } from "@/api";
import type { CourseCard } from "@/api/types";
import { useAuth } from "@/features/auth/AuthContext";
import { SiteHeader } from "@/shared/components/SiteHeader";
import { SiteFooter } from "@/shared/components/SiteFooter";
import { EmptyState } from "@/shared/ui/EmptyState";
import { BioBadge, PageBackdrop } from "@/shared/components/bio";
import { SITE } from "@/shared/i18n/site";
import { CourseCardPublic } from "./CourseCardPublic";
import { BtnNucleus } from "@/shared/ui/Button";
import { RedeemCodeForm } from "./components/RedeemCodeForm";
import { welcomeHref } from "./welcome";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

const EMPTY_CLASSES =
  "rounded-3xl border-2 border-dashed border-primary/25 bg-card/70 px-6 py-14 text-center text-base font-bold text-foreground";

export function CoursesBrowseView() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await coursesApi.list();
        if (!cancelled) setCourses(res.courses);
      } catch (err) {
        if (!cancelled)
          setError(isApiError(err) ? err.message : "حصل خطأ في تحميل الكورسات");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="relative flex-1 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <PageBackdrop />
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="text-center sm:text-start">
            <BioBadge>مكتبة الكورسات</BioBadge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              الكورسات{" "}
              <span className="text-gradient-brand">المتاحة لمرحلتك</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              اختَر كورس، اشتريه، وابدأ تفهم {SITE.subject} على طول.
            </p>
            {isAuthenticated && !authLoading && (
              <RedeemCodeForm
                className="mt-3 sm:max-w-md"
                onRedeemed={(course) => router.push(welcomeHref(course.slug))}
              />
            )}
          </div>

          {authLoading || loading ? (
            <LoadingScreen variant="page" />
          ) : !isAuthenticated ? (
            <EmptyState
              className={EMPTY_CLASSES}
              message="لازم تسجّل دخول عشان تشوف الكورسات المتاحة لمرحلتك"
              hint={
                <Link href="/login" className="btn btn-primary mt-2">
                  <BtnNucleus />
                  تسجيل الدخول
                </Link>
              }
            />
          ) : error ? (
            <EmptyState className={EMPTY_CLASSES} message={error} />
          ) : courses.length === 0 ? (
            <EmptyState
              className={EMPTY_CLASSES}
              message="لسه مفيش كورسات متاحة لمرحلتك حالياً — قريب جداً 🌱"
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <CourseCardPublic key={c._id} course={c} />
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
