"use client";

import Link from "next/link";
import { useSiteSettings } from "@/shared/site-settings";
import {
  BioDivider,
  BioIcon,
  CellPattern,
  FloatingSpecimen,
} from "@/shared/components/bio";
import { BtnNucleus } from "@/shared/ui/Button";
import { Reveal } from "@/shared/ui/Reveal";

export function LessonsEmptyState() {
  const { contact } = useSiteSettings();
  return (
    <Reveal margin="-50px" rise={30} className="mx-6 sm:mx-10 lg:mx-12">
      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border-2 border-dashed border-primary/30 bg-card/60 p-8 text-center sm:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%)",
          }}
        />
        <CellPattern className="text-primary/5" />

        <FloatingSpecimen
          name="leaf"
          className="-right-3 -top-3 size-36 text-primary/8"
          still
        />
        <FloatingSpecimen
          name="crystal"
          className="-bottom-4 -left-4 size-36 text-highlight/8"
          still
        />

        <Reveal
          margin="0px"
          rise={12}
          delay={0.2}
          className="relative mx-auto flex size-20 items-center justify-center rounded-3xl bg-gradient-brand shadow-brand"
        >
          <span className="absolute inset-0 -z-10 animate-pulse-soft rounded-3xl bg-primary/40 blur-xl" />
          <span className="absolute inset-0 animate-ripple rounded-3xl border-2 border-primary/40" />
          <BioIcon
            name="microscope"
            className="size-10 text-primary-foreground"
            strokeWidth={1.8}
          />
        </Reveal>

        <Reveal margin="0px" rise={10} delay={0.3} className="relative mt-6">
          <h3 className="text-2xl font-extrabold text-foreground sm:text-3xl">
          لسه مفيش كورسات متاحة حالياً
          </h3>
        </Reveal>

        <Reveal margin="0px" rise={10} delay={0.4} className="relative mt-3">
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          الكورسات في الطريق، وقريب جداً هتكون متاحة هنا إن شاء الله 🤍
          </p>
        </Reveal>

        <Reveal margin="0px" rise={0} delay={0.5}>
          <BioDivider icon="dna" className="relative mt-6" />
        </Reveal>

        <Reveal
          margin="0px"
          rise={10}
          delay={0.6}
          className="relative mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <a
            href={contact.whatsappLink || "#contact"}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            <BtnNucleus>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.52 3.48A11.77 11.77 0 0 0 12.06 0C5.5 0 .2 5.3.2 11.84c0 2.09.55 4.13 1.6 5.93L0 24l6.4-1.68a11.82 11.82 0 0 0 5.66 1.44h.01c6.55 0 11.85-5.3 11.85-11.84a11.77 11.77 0 0 0-3.4-8.44Z" />
              </svg>
            </BtnNucleus>
            تواصل معانا
          </a>
          <Link
            href="#contact"
            className="btn btn-secondary"
          >
            خلّيك على تواصل
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
          </Link>
        </Reveal>
      </div>
    </Reveal>
  );
}
