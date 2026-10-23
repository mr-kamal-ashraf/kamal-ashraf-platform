"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/navigation";

import { coursesApi } from "@/api";
import type { CourseCard } from "@/api/types";
import { CourseCardBig } from "@/features/courses/components/CourseCardBig";
import { useAuth } from "@/features/auth/AuthContext";
import { BioBadge, CellPattern, FloatingSpecimen } from "@/shared/components/bio";
import { SITE } from "@/shared/i18n/site";
import { LessonsEmptyState } from "./LessonsEmptyState";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

export function LessonsCarousel() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const swiperRef = useRef<SwiperType | null>(null);
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await coursesApi.listPreview();
        if (!cancelled) {
          setCourses(res?.courses ?? []);
        }
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

  const hasCourses = courses.length > 0;

  return (
    <section
      id="lessons"
      className="relative w-full scroll-mt-28 overflow-hidden py-20 md:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 50% 30%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%)",
        }}
      />

      <CellPattern
        className="-z-10 text-primary/5 dark:text-primary/7"
        scale={1.2}
      />
      <FloatingSpecimen
        name="mitochondria"
        className="left-[3%] top-16 -z-10 hidden size-20 text-highlight/12 md:block"
        delay={3}
      />
      <FloatingSpecimen
        name="neuron"
        className="bottom-10 right-[4%] -z-10 hidden size-20 text-primary/10 md:block"
        delay={9}
      />

      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 flex flex-col items-start justify-between gap-6 px-6 sm:flex-row sm:items-end sm:px-10 lg:px-12"
        >
          <div className="max-w-2xl">
            <BioBadge>الكورسات</BioBadge>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              الكورسات <span className="text-gradient-brand">المتاحة</span> لسنة
              <span className="mx-2">/</span>
              <span className="text-gradient-highlight">2026</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              كورسات مترتبة لكل مرحلة — اختار كورسك وابدأ تفهم{" "}
              {SITE.subject} صح من أول درس.
            </p>
          </div>

          {!isLoading && hasCourses && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => swiperRef.current?.slidePrev()}
                aria-label="السابق"
                className="btn btn-secondary btn-lg btn-icon"
              >
                <svg
                  className="size-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              <button
                onClick={() => swiperRef.current?.slideNext()}
                aria-label="التالي"
                className="btn btn-secondary btn-lg btn-icon"
              >
                <svg
                  className="size-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            </div>
          )}
        </motion.div>

        {isLoading ? (
          <LoadingScreen className="rounded-none border-0 bg-transparent py-10" />
        ) : hasCourses ? (
          <div className="relative w-full">
            <Swiper
              dir="rtl"
              modules={[Navigation]}
              onSwiper={(s) => {
                swiperRef.current = s;
              }}
              spaceBetween={20}
              slidesPerView={1.1}
              breakpoints={{
                480: { slidesPerView: 1.3, spaceBetween: 20 },
                640: { slidesPerView: 1.7, spaceBetween: 22 },
                768: { slidesPerView: 2.1, spaceBetween: 24 },
                1024: { slidesPerView: 2.6, spaceBetween: 26 },
                1280: { slidesPerView: 3, spaceBetween: 28 },
                1536: { slidesPerView: 3.4, spaceBetween: 30 },
                1920: { slidesPerView: 4, spaceBetween: 32 },
              }}
              className="px-6! sm:px-10! lg:px-12!"
            >
              {courses.map((course, idx) => (
                <SwiperSlide key={course._id} className="h-auto">
                  <CourseCardBig course={course} index={idx} />
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Edge fade from sm up; on phones it covered the next card's
                visible edge entirely. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-2 hidden w-24 sm:block md:w-32 lg:w-40"
              style={{
                background:
                  "linear-gradient(to left, transparent, var(--background) 95%)",
              }}
            />
          </div>
        ) : (
          <LessonsEmptyState />
        )}
      </div>
    </section>
  );
}
