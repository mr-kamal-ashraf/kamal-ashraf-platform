"use client";

import Image from "next/image";
import Link from "next/link";
import { resolveAssetUrl } from "@/config/env";
import { toArabicDigits } from "@/shared/lib/arabic";
import { isOptimizable } from "@/shared/lib/images";
import { getLessonGradient } from "@/shared/lib/stage";
import { Reveal } from "@/shared/ui/Reveal";
import { StageBadge } from "@/shared/ui/StageBadge";
import type { CourseCard } from "@/api/types";
import { CoverArt } from "@/shared/components/bio";

interface CourseCardBigProps {
  course: CourseCard;
  index: number;
}

/**
 * Rich course card used inside the home carousel — visually mirrors the old
 * lesson card so the slider looks identical, but carries course data (price,
 * lesson count) and links to the course detail/purchase page.
 */
export function CourseCardBig({ course, index }: CourseCardBigProps) {
  const background = getLessonGradient(course.stage, course.thumbnailGradient);
  const thumbnailSrc = resolveAssetUrl(course.thumbnail);

  return (
    <Reveal
      // Inset the trigger vertically only: the next card peeking in from the
      // side of the carousel must reveal with the first (an all-sides inset
      // kept it invisible until it was swiped fully into view).
      margin="-50px 0px"
      rise={30}
      delay={(index % 4) * 0.08}
    >
      <Link
        href={`/courses/${course.slug}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-brand"
      >
        <span className="absolute inset-x-0 top-0 z-30 h-1 bg-gradient-brand" />

        <div
          className="relative aspect-video w-full overflow-hidden"
          style={{ background }}
        >
          {thumbnailSrc ? (
            <Image
              src={thumbnailSrc}
              alt={course.title}
              fill
              sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 90vw"
              unoptimized={!isOptimizable(thumbnailSrc)}
              className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            />
          ) : (
            <CoverArt seed={course.slug} />
          )}

          <div
            className="absolute inset-0 bg-linear-to-t from-black/60 via-black/15 to-transparent"
            aria-hidden
          />

          <div className="absolute inset-x-4 top-4 flex items-start justify-between">
            <StageBadge stage={course.stage} />

            {course.owned && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-emerald-600/80 px-3 py-1 text-[11px] font-bold text-white">
                مشترك ✓
              </span>
            )}
          </div>

          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
            <div className="flex size-16 items-center justify-center rounded-full bg-card shadow-brand ring-4 ring-primary/30 transition-transform duration-300 group-hover:scale-110">
              <svg
                className="size-6 translate-x-0.5 text-primary"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          <div className="absolute inset-x-4 bottom-4 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] font-semibold text-white">
              <svg
                className="size-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
              </svg>
              {toArabicDigits(course.lessonsCount)} درس
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-6">
          {course.owned ? (
            <span className="mb-2 inline-flex items-center gap-1.5 text-lg font-extrabold italic text-emerald-600">
              مشترك
              <svg
                className="size-5 not-italic"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
          ) : (
            <span className="mb-2 text-xl font-black text-primary">
              {course.price > 0
                ? `${toArabicDigits(course.price)} ج.م.`
                : "مجاني"}
            </span>
          )}

          <h3 className="text-xl font-extrabold leading-tight transition-colors group-hover:text-primary">
            {course.title}
          </h3>
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {course.description}
          </p>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary transition-transform group-hover:-translate-x-1">
              {course.owned ? "افتح الكورس" : "التفاصيل والشراء"}
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </span>
            <span aria-hidden className="btn btn-secondary btn-sm btn-icon text-primary">
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>
        </div>
      </Link>
    </Reveal>
  );
}
