"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SITE } from "@/shared/i18n/site";
import { cn } from "@/shared/lib/cn";
import { useAuth } from "@/features/auth/AuthContext";
import { useSiteSettings } from "@/shared/site-settings";
import { BioBadge, BioIcon, SectionBackdrop } from "@/shared/components/bio";
import {
  AllInOneHub,
  DetailedLesson,
  LessonPlayer,
  SolveSteps,
} from "./visuals";
import { BtnNucleus } from "@/shared/ui/Button";

/** Illustration + grid placement for each feature position. */
const LAYOUT: Array<{ visual: ReactNode; className: string }> = [
  // tall card on the start side
  { visual: <DetailedLesson />, className: "md:row-span-2" },
  // wide card
  { visual: <SolveSteps />, className: "lg:col-span-2" },
  { visual: <LessonPlayer />, className: "" },
  { visual: <AllInOneHub />, className: "md:col-span-2 lg:col-span-1" },
];

/**
 * "Why us" as a bento grid: four features of different sizes, each with a
 * small illustration of what it means, closed by the platform's goal.
 */
export function WhyUs() {
  const { isAuthenticated } = useAuth();
  const { whyUs } = useSiteSettings();

  return (
    <section id="why" className="relative isolate scroll-mt-28 overflow-x-clip py-24 md:py-32">
      <SectionBackdrop variant="tissue" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <BioBadge tone="highlight">مميزات المنصة</BioBadge>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            ليه <span className="text-primary">تختارنا؟</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            مش مجرد دروس فيديو، ده نظام كامل اتصمم عشان تفهم {SITE.subject}{" "}
            وتحبها مع {SITE.teacherName}.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {whyUs.items.map((item, i) => {
            const layout = LAYOUT[i] ?? LAYOUT[LAYOUT.length - 1];
            return (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
                className={cn(
                  "group flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 shadow-soft transition-colors duration-300 hover:border-primary/30 sm:p-6",
                  layout.className,
                )}
              >
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-primary/10 bg-primary/4 p-4 sm:p-5">
                  <div className="w-full">{layout.visual}</div>
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-extrabold leading-snug text-foreground sm:text-xl">
                    {item.title}
                    <span className="text-base sm:text-lg" aria-hidden>
                      {item.emoji}
                    </span>
                  </h3>
                  <p className="mt-2 text-sm leading-loose text-muted-foreground sm:text-[15px]">
                    {item.description}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* the goal */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="mt-5 flex flex-col items-center gap-5 rounded-3xl border border-primary/20 bg-primary/6 px-6 py-7 text-center sm:px-10 lg:flex-row lg:gap-8 lg:text-start"
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-brand">
            <BioIcon name="heartPulse" className="size-7" />
          </span>
          <p className="flex-1 text-lg font-extrabold leading-relaxed text-foreground sm:text-xl">
            {whyUs.goal} <span aria-hidden>❤️</span>
          </p>
          <Link
            href={isAuthenticated ? "/courses" : "/register"}
            className="btn btn-primary btn-lg shrink-0"
          >
            <BtnNucleus />
            {isAuthenticated ? "شوف الكورسات" : "ابدأ رحلتك دلوقتي"}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
