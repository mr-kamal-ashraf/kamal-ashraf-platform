"use client";

import Image from "next/image";
import Link from "next/link";
import { resolveAssetUrl } from "@/config/env";
import {
  formatDurationMinutes,
  toArabicDigits,
} from "@/shared/lib/arabic";
import { isOptimizable } from "@/shared/lib/images";
import { riseIn } from "@/shared/lib/riseIn";
import { getLessonGradient } from "@/shared/lib/stage";
import { StageBadge } from "@/shared/ui/StageBadge";
import { CoverArt } from "@/shared/components/bio";
import { useLessonDetails } from "../LessonDetailsProvider";
import { BtnNucleus } from "@/shared/ui/Button";

export function LessonDetailsHero() {
  const { lesson } = useLessonDetails();
  if (!lesson) return null;

  const duration = formatDurationMinutes(lesson.durationMinutes);
  const gradient = getLessonGradient(lesson.stage, lesson.thumbnailGradient);
  const thumbnailSrc = resolveAssetUrl(lesson.thumbnail);

  return (
    <section className="relative border-b border-border/60">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 50% 0%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <nav
          style={riseIn({ y: 0, duration: 0.4 })}
          className="rise-in mb-6 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-primary">
            الرئيسية
          </Link>
          <span>/</span>
          <Link href="/#lessons" className="hover:text-primary">
            الدروس
          </Link>
          <span>/</span>
          <span className="font-semibold text-foreground">{lesson.title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div
              style={riseIn({ duration: 0.6 })}
              className="rise-in flex flex-wrap items-center gap-2"
            >
              <StageBadge stage={lesson.stage} />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-soft">
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
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-soft">
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

            <h1
              style={riseIn({ delay: 0.1, duration: 0.6 })}
              className="rise-in mt-5 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl"
            >
              {lesson.title}
            </h1>

            <p
              style={riseIn({ delay: 0.2, duration: 0.6 })}
              className="rise-in mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              {lesson.longDescription}
            </p>

            <div
              style={riseIn({ delay: 0.3, duration: 0.6 })}
              className="rise-in mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                href={`/player/${lesson.slug}`}
                className="btn btn-primary btn-lg"
              >
                <BtnNucleus>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </BtnNucleus>
                ابدأ المشاهدة
              </Link>
              <Link
                href="/#lessons"
                className="btn btn-secondary btn-lg"
              >
                ارجع لكل الدروس
              </Link>
            </div>
          </div>

          <div
            style={riseIn({ y: 0, scale: 0.95, delay: 0.1 })}
            className="rise-in lg:col-span-2"
          >
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-2 shadow-elegant">
              <div
                className="relative aspect-video w-full overflow-hidden rounded-2xl"
                style={{ background: gradient }}
              >
                {thumbnailSrc && (
                  <Image
                    src={thumbnailSrc}
                    alt={lesson.title}
                    fill
                    priority
                    sizes="(min-width: 1152px) 430px, (min-width: 1024px) 38vw, 100vw"
                    unoptimized={!isOptimizable(thumbnailSrc)}
                    className="object-cover"
                  />
                )}

                {!thumbnailSrc && (
                  <CoverArt seed={lesson.slug} glyphClassName="size-40" />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                <div className="absolute inset-0 flex items-center justify-center">
                  <Link
                    href={`/player/${lesson.slug}`}
                    aria-label="ابدأ المشاهدة"
                    className="flex size-16 items-center justify-center rounded-full bg-gradient-brand shadow-brand ring-4 ring-white/20 transition-transform hover:scale-110"
                  >
                    <svg
                      className="size-6 translate-x-0.5 text-primary-foreground"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
