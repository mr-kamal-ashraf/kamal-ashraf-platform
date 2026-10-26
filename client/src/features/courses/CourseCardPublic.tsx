"use client";

import Image from "next/image";
import Link from "next/link";
import { StageBadge } from "@/shared/ui/StageBadge";
import { getLessonGradient } from "@/shared/lib/stage";
import { toArabicDigits } from "@/shared/lib/arabic";
import { resolveAssetUrl } from "@/config/env";
import { isOptimizable } from "@/shared/lib/images";
import { BioIcon, CoverArt } from "@/shared/components/bio";
import type { CourseCard } from "@/api/types";

export function CourseCardPublic({ course }: { course: CourseCard }) {
  const thumb = resolveAssetUrl(course.thumbnail);
  const gradient = getLessonGradient(course.stage, course.thumbnailGradient);

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="card-strata card-strata-hover group relative flex flex-col overflow-hidden rounded-3xl hover:border-primary/40"
    >

      <div
        className="relative aspect-video overflow-hidden"
        style={{ background: gradient }}
      >
        {thumb ? (
          <Image
            src={thumb}
            alt={course.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            unoptimized={!isOptimizable(thumb)}
            className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          />
        ) : (
          <CoverArt seed={course.slug} glyphClassName="size-24 sm:size-28" />
        )}
        <div
          className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent"
          aria-hidden
        />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <StageBadge stage={course.stage} />
          {course.owned && (
            <span className="rounded-full border border-white/20 bg-emerald-600/85 px-2.5 py-1 text-[11px] font-bold text-white">
              مشترك ✓
            </span>
          )}
        </div>
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white">
          <BioIcon name="book" className="size-3" strokeWidth={2.5} />
          {toArabicDigits(course.lessonsCount)} درس
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-base font-extrabold leading-snug text-foreground transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {course.description}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-3">
          <span className="text-base font-black text-primary">
            {course.owned
              ? ""
              : course.price > 0
                ? `${toArabicDigits(course.price)} ج.م`
                : "مجاني"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary transition-transform group-hover:-translate-x-1">
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
        </div>
      </div>
    </Link>
  );
}
