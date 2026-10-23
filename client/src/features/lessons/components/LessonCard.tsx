"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { resolveAssetUrl } from "@/config/env";
import { formatDurationMinutes, toArabicDigits } from "@/shared/lib/arabic";
import { getLessonGradient } from "@/shared/lib/stage";
import { StageBadge } from "@/shared/ui/StageBadge";
import type { LessonPreview } from "@/api/types";
import { CoverArt } from "@/shared/components/bio";

interface LessonCardProps {
  lesson: LessonPreview;
  index: number;
}

export function LessonCard({ lesson, index }: LessonCardProps) {
  const duration = formatDurationMinutes(lesson.durationMinutes);
  const background = getLessonGradient(lesson.stage, lesson.thumbnailGradient);
  const thumbnailSrc = resolveAssetUrl(lesson.thumbnail);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.08 }}
    >
      <Link
        href={`/lessons/${lesson.slug}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-brand"
      >
        <span className="absolute inset-x-0 top-0 z-30 h-1 bg-gradient-brand" />

        <div
          className="relative aspect-video w-full overflow-hidden"
          style={{ background }}
        >
          {thumbnailSrc && (
            <img
              src={thumbnailSrc}
              alt={lesson.title}
              className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
              loading="lazy"
            />
          )}

          {!thumbnailSrc && <CoverArt seed={lesson.slug} />}

          <div
            className="absolute inset-0 bg-linear-to-t from-black/60 via-black/15 to-transparent"
            aria-hidden
          />

          <div className="absolute inset-x-4 top-4 flex items-start justify-between">
            <StageBadge stage={lesson.stage} />

            <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1">
              <svg
                className="size-3 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z" />
              </svg>
              <span className="text-[10px] font-bold text-white">ضمن كورس</span>
            </div>
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
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" strokeLinecap="round" />
              </svg>
              {duration}
            </span>
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
              {toArabicDigits(lesson.chapters)} فصول
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-6">
          <h3 className="text-xl font-extrabold leading-tight transition-colors group-hover:text-primary">
            {lesson.title}
          </h3>
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {lesson.description}
          </p>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary transition-transform group-hover:-translate-x-1">
              شوف التفاصيل
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
    </motion.div>
  );
}
