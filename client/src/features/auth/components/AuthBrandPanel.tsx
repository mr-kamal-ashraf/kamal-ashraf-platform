"use client";

import { motion } from "framer-motion";
import { SITE } from "@/shared/i18n/site";
import {
  BioBadge,
  BioDivider,
  CellPattern,
  FloatingSpecimen,
  MicroscopeLens,
} from "@/shared/components/bio";

interface AuthBrandPanelProps {
  title: string;
  subtitle: string;
}

/**
 * Left-hand brand panel on login/register (desktop only): a living
 * "microscope view" illustration, the welcome line and a divider.
 */
export function AuthBrandPanel({ title, subtitle }: AuthBrandPanelProps) {
  return (
    <div className="relative hidden overflow-hidden lg:sticky lg:top-24 lg:block lg:h-[calc(100vh-6rem)]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, var(--card) 0%, color-mix(in oklab, var(--primary) 8%, var(--card)) 50%, color-mix(in oklab, var(--highlight) 6%, var(--card)) 100%)",
        }}
      />
      <CellPattern className="text-primary/6" />

      <FloatingSpecimen
        name="leaf"
        className="right-[8%] bottom-[22%] size-20 text-tertiary/20"
        delay={3}
      />
      <FloatingSpecimen
        name="ammonite"
        className="left-[6%] top-[14%] size-16 text-highlight/12"
        delay={8}
      />

      <div className="absolute right-8 top-8 z-10">
        <BioBadge className="shadow-soft">منصة {SITE.teacherName}</BioBadge>
      </div>

      <div className="relative flex h-full flex-col items-center justify-center gap-8 px-8 pb-10 pt-20 lg:px-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7 }}
          className="flex w-full justify-center"
        >
          <MicroscopeLens className="max-w-[min(22rem,48vh)]" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center"
        >
          <h2
            className="text-2xl font-extrabold leading-tight text-foreground xl:text-3xl"
            dangerouslySetInnerHTML={{ __html: title }}
          />
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground xl:text-base">
            {subtitle}
          </p>

          <BioDivider icon="dna" tone="primary" className="mt-5" />
        </motion.div>
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 65% at center, transparent 45%, color-mix(in oklab, var(--primary) 10%, transparent) 100%)",
        }}
      />
    </div>
  );
}
