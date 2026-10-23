"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { coursesApi } from "@/api";
import type { CourseCard } from "@/api/types";
import { CourseCardPublic } from "@/features/courses/CourseCardPublic";
import { useAuth } from "@/features/auth/AuthContext";
import { BtnNucleus } from "@/shared/ui/Button";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

export function CoursesShowcase() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await coursesApi.listPreview();
        if (!cancelled) setCourses(res?.courses ?? []);
      } catch {
        if (!cancelled) setCourses([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  if (!isLoading && courses.length === 0) return null;

  return (
    <section
      id="courses"
      className="relative w-full scroll-mt-20 overflow-hidden py-20 md:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 50% 30%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
            الكورسات المتاحة
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            اختَر كورسك، اشتريه، وابدأ تذاكر مع المستر خطوة بخطوة.
          </p>
        </div>

        {isLoading ? (
          <LoadingScreen className="rounded-none border-0 bg-transparent py-10" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.slice(0, 6).map((c) => (
                <CourseCardPublic key={c._id} course={c} />
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/courses"
                className="btn btn-primary btn-lg"
              >
                <BtnNucleus />
                شوف كل الكورسات
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
