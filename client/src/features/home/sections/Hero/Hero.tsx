"use client";

import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/shared/i18n/site";
import { riseIn } from "@/shared/lib/riseIn";
import { useAuth } from "@/features/auth/AuthContext";
import {
  RichText,
  heroHeadline,
  useSiteSettings,
  type HeadlinePart,
} from "@/shared/site-settings";
import { BtnNucleus } from "@/shared/ui/Button";
import {
  BioBadge,
  BioIcon,
  CellPattern,
  DnaHelix,
  FloatingSpecimen,
} from "@/shared/components/bio";
import { HeroStats } from "./HeroStats";

/** Headline text with الكلمة الملونة in the brand gradient (see headline.ts). */
function HeadlineParts({ parts }: { parts: HeadlinePart[] }) {
  return parts.map((part, i) =>
    part.highlight ? (
      <span key={i} className="text-gradient-bio">
        {part.text}
      </span>
    ) : (
      <Fragment key={i}>{part.text}</Fragment>
    ),
  );
}

/** Hand-drawn double strand underline — a tiny helix. */
function HelixUnderline({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block">
      <span className="relative z-10">{children}</span>
      <svg
        className="absolute -bottom-3 left-0 right-0 h-4 w-full"
        viewBox="0 0 300 16"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden
      >
        <path
          d="M2 8 C 40 -2, 70 18, 110 8 S 180 -2, 220 8 S 280 18, 298 8"
          pathLength={1}
          className="draw-in"
          stroke="var(--highlight)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M2 8 C 40 18, 70 -2, 110 8 S 180 18, 220 8 S 280 -2, 298 8"
          pathLength={1}
          className="draw-in"
          style={{ animationDelay: "1.25s" }}
          stroke="var(--primary)"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** Line 2: the helix underlines the coloured phrase, or the whole line when
 *  the phrase is in line 1. */
function HeadlineLine2({ parts }: { parts: HeadlinePart[] }) {
  if (!parts.some((part) => part.highlight)) {
    return (
      <HelixUnderline>{parts.map((part) => part.text).join("")}</HelixUnderline>
    );
  }
  return parts.map((part, i) =>
    part.highlight ? (
      <HelixUnderline key={i}>
        <span className="text-gradient-bio">{part.text}</span>
      </HelixUnderline>
    ) : (
      <Fragment key={i}>{part.text}</Fragment>
    ),
  );
}

export function Hero() {
  const { isAuthenticated, isLoading } = useAuth();
  const { hero, assets } = useSiteSettings();
  const headline = heroHeadline(hero);

  return (
    <section className="relative overflow-hidden [contain:paint]">
      {/* ── Background: soft glow · faint tissue pattern · two drifting specimens ── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 85% 20%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 60%), radial-gradient(ellipse 55% 60% at 8% 90%, color-mix(in oklab, var(--highlight) 9%, transparent), transparent 60%)",
          }}
        />
        <CellPattern className="text-primary/5 dark:text-primary/7" />

        <FloatingSpecimen
          name="dna"
          className="left-[3%] top-[8%] size-20 text-primary/12 sm:size-24"
        />
        <FloatingSpecimen
          name="leaf"
          className="right-[4%] top-[6%] hidden size-16 text-primary/12 md:block"
          delay={6}
        />

        <svg
          className="absolute inset-x-0 bottom-0 h-24 w-full text-primary/8"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* lg+: the portrait's column is 10% wider than the copy's, so the
          portrait grows on laptops instead of giving way to the column gap. */}
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 md:pb-28 md:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:px-8 xl:gap-16">
        {/* ── Copy ── (a size container: the headline scales with its width) */}
        <div
          style={riseIn({ y: 30 })}
          className="rise-in @container relative z-10 text-center lg:text-start"
        >
          <div
            style={riseIn({ y: 0, scale: 0.9, delay: 0.1, duration: 0.5 })}
            className="rise-in"
          >
            <BioBadge>{hero.badge}</BioBadge>
          </div>

          {/* sm+: the size is capped by the column width (8.5cqi ≈ the default
              first line's width ÷ 11.7), so that line fits on one line; a
              longer one the teacher writes wraps instead of running into the
              portrait. */}
          <h1
            style={riseIn({ delay: 0.2 })}
            className="rise-in mt-6 text-[calc(2rem*var(--font-scale,1))] font-extrabold leading-[max(1.6,var(--font-leading,0))] tracking-tight sm:text-[calc(min(3rem,8.5cqi)*var(--font-scale,1))] xl:text-[calc(min(3.25rem,8.5cqi)*var(--font-scale,1))]"
          >
            <HeadlineParts parts={headline.line1} />
            <br className="hidden sm:block" />{" "}
            <HeadlineLine2 parts={headline.line2} />
          </h1>

          <p
            style={riseIn({ delay: 0.4 })}
            className="rise-in mx-auto mt-7 max-w-xl text-base leading-loose text-muted-foreground sm:text-lg lg:mx-0"
          >
            <RichText text={hero.description} />
          </p>

          <div
            style={riseIn({ delay: 0.55, duration: 0.6 })}
            // Phones: both buttons stacked at full width. sm+: side by side.
            className="rise-in mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start"
          >
            {!isLoading && !isAuthenticated && (
              <Link
                href="/register"
                className="btn btn-primary btn-lg w-full sm:w-auto"
              >
                <BtnNucleus />
                {hero.primaryCta}
              </Link>
            )}
            <a
              href="#lessons"
              className="btn btn-secondary btn-lg w-full sm:w-auto"
            >
              <svg
                className="size-4 text-primary"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              {hero.secondaryCta}
            </a>
          </div>

          <div style={riseIn({ delay: 0.7, duration: 0.6 })} className="rise-in">
            <HeroStats className="mx-auto mt-10 max-w-lg lg:mx-0" />
          </div>
        </div>

        {/* ── Teacher portrait ── */}
        <div
          style={riseIn({ y: 0, scale: 0.94, delay: 0.2, duration: 0.9 })}
          // Phones: the portrait runs edge to edge (cancels the 1rem page
          // padding) instead of sitting small inside it; the section clips.
          className="rise-in relative -mx-4 w-[calc(100%+2rem)] sm:mx-auto sm:w-full sm:max-w-lg lg:max-w-none"
        >
          <div
            className="absolute inset-0 -z-20"
            style={{
              background:
                "radial-gradient(ellipse 55% 60% at 50% 50%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)",
            }}
          />

          {/* slow dashed orbit — spun inside a round, clipped frame so the
              rotating square's corners can never widen the page on phones */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 overflow-clip rounded-full"
          >
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 size-full animate-spin-slow"
            >
              <circle
                cx="50"
                cy="50"
                r="48.5"
                fill="none"
                stroke="var(--primary)"
                strokeOpacity="0.22"
                strokeWidth="0.35"
                strokeDasharray="1.5 3.5"
              />
            </svg>
          </div>

          {/* turning DNA strand at the side */}
          <div className="pointer-events-none absolute -left-2 top-[8%] hidden h-[72%] w-14 text-primary/60 sm:block lg:-left-6">
            <DnaHelix rungs={12} className="size-full" />
          </div>

          {/* Fades in (outer), floats (inner). Two animations on one element
              would make the browser run every animation on the page on the
              main thread, every frame — so they're split. */}
          <div
            style={riseIn({ x: 30, y: -10, delay: 0.8, duration: 0.6 })}
            className="rise-in absolute -right-2 top-12 z-20 hidden sm:block lg:-right-4"
          >
            <div className="flex animate-float items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-elegant">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BioIcon name="microscope" className="size-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-foreground">
                  شرح بالرسم والتجربة
                </div>
                <div className="text-[10px] text-muted-foreground">
                  تشوف المعلومة قدامك
                </div>
              </div>
            </div>
          </div>

          <div
            style={riseIn({ x: -30, y: 10, delay: 1, duration: 0.6 })}
            className="rise-in absolute -left-2 bottom-24 z-20 hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-elegant sm:block lg:left-2"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-highlight/12 text-highlight">
                <BioIcon name="users" className="size-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-foreground">
                  +٥٠٠٠ طالب
                </div>
                <div className="text-[10px] text-muted-foreground">
                  بيتفوقوا معانا
                </div>
              </div>
            </div>
          </div>

          <div
            style={riseIn({ y: 0, scale: 0.8, delay: 1.2, duration: 0.6 })}
            className="rise-in absolute bottom-6 right-2 z-20 hidden rounded-2xl bg-primary px-3.5 py-2.5 shadow-brand md:block lg:-right-2 lg:bottom-14"
          >
            <div className="flex items-center gap-2 text-primary-foreground">
              <BioIcon name="spark" className="size-4 shrink-0" />
              <span className="whitespace-nowrap text-[11px] font-bold">
                مساعد ذكي بيجاوبك ٢٤ ساعة
              </span>
            </div>
          </div>

          <Image
            src={assets.hero}
            alt={`صورة ${SITE.teacherName}`}
            width={1254}
            height={1254}
            priority
            sizes="(min-width: 1024px) 600px, (min-width: 640px) 512px, 100vw"
            // Width comes from the column (capped at 600px), never from the
            // file: with w-auto the browser sizes the image as file pixels ÷
            // srcset density, so a phone that gets the 1254px original for a
            // "1920w" candidate showed it at ~65% of the column.
            className="relative z-10 mx-auto h-auto w-full max-w-150"
          />
        </div>
      </div>
    </section>
  );
}
