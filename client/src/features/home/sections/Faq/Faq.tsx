"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { SITE } from "@/shared/i18n/site";
import { cn } from "@/shared/lib/cn";
import { toArabicDigits } from "@/shared/lib/arabic";
import { BioBadge, SectionBackdrop } from "@/shared/components/bio";
import { IconWhatsapp } from "@/shared/components/SiteFooter/socialIcons";
import { useSiteSettings } from "@/shared/site-settings";
import { BtnNucleus } from "@/shared/ui/Button";

/** Softens the raw scroll position so cards glide instead of tracking the wheel 1:1. */
const SPRING = { stiffness: 140, damping: 26, mass: 0.4 };

/** The hexagon each timeline node is drawn as. */
const HEX = "M22 2.5 39 12.25v19.5L22 41.5 5 31.75v-19.5Z";

type Side = "right" | "left";

/**
 * How the section moves: `reduce` — the device asks for no motion (everything
 * just in place).
 */
interface MotionMode {
  reduce: boolean;
}

/**
 * A latched scroll progress: it only ever moves forward, so scrolling back up
 * doesn't undo an entrance — what has come in stays put.
 */
function useLatched(progress: MotionValue<number>) {
  const driver = useMotionValue(progress.get());
  useMotionValueEvent(progress, "change", (v) => {
    driver.set(Math.max(driver.get(), v));
  });
  return driver;
}

/**
 * A card's entrance, tied to scrolling: it slides in from its own side,
 * straightens and settles, and its node on the timeline fills once it lands.
 * It plays the first time only and stays — scrolling back up and down again
 * doesn't replay it. With reduced motion it's simply in place (constant
 * values are swapped in, so nothing is left half-way).
 */
function useEntrance(ref: RefObject<HTMLElement | null>, from: Side | "below", mode: MotionMode) {
  const { reduce } = mode;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 96%", "start 60%"],
  });
  const progress = useLatched(useSpring(scrollYProgress, SPRING));
  const sign = from === "right" ? 1 : -1;
  const opacity = useTransform(progress, [0, 0.6], [0, 1]);
  const x = useTransform(progress, [0, 1], from === "below" ? [0, 0] : [sign * 96, 0]);
  const y = useTransform(progress, [0, 1], from === "below" ? [48, 0] : [18, 0]);
  const rotate = useTransform(progress, [0, 1], from === "below" ? [0, 0] : [sign * 2.5, 0]);
  const scale = useTransform(progress, [0, 1], [0.94, 1]);
  const lit = useTransform(progress, [0.7, 1], [0, 1]);
  const one = useMotionValue(1);
  const zero = useMotionValue(0);
  return {
    style: reduce
      ? { opacity: one, x: zero, y: zero, rotate: zero, scale: one }
      : { opacity, x, y, rotate, scale },
    lit: reduce ? one : lit,
  };
}

/** A stop on the timeline: a hexagon that fills with the brand colour. */
function Node({
  lit,
  className,
  children,
}: {
  lit: MotionValue<number>;
  className?: string;
  children: ReactNode;
}) {
  const unlit = useTransform(lit, (v) => 1 - v);
  return (
    <span
      aria-hidden
      className={cn("relative z-10 flex size-11 shrink-0 items-center justify-center", className)}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-full">
        <path d={HEX} className="fill-card stroke-border" strokeWidth="1.5" strokeLinejoin="round" />
        <motion.path
          d={HEX}
          className="fill-primary stroke-primary"
          strokeWidth="1.5"
          strokeLinejoin="round"
          style={{ opacity: lit }}
        />
      </svg>
      <motion.span
        className="absolute text-sm font-black tabular-nums text-muted-foreground"
        style={{ opacity: unlit }}
      >
        {children}
      </motion.span>
      <motion.span
        className="absolute text-sm font-black tabular-nums text-primary-foreground"
        style={{ opacity: lit }}
      >
        {children}
      </motion.span>
    </span>
  );
}

function FaqRow({
  index,
  question,
  answer,
  open,
  onToggle,
  baseId,
  mode,
}: {
  index: number;
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
  baseId: string;
  mode: MotionMode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  // Alternating sides: 1st on the right, 2nd on the left, …
  const side: Side = index % 2 === 0 ? "right" : "left";
  const { style, lit } = useEntrance(ref, side, mode);
  const buttonId = `${baseId}-q-${index}`;
  const panelId = `${baseId}-a-${index}`;

  return (
    <li
      ref={ref}
      className="relative ps-16 md:grid md:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] md:items-start md:ps-0"
    >
      <Node
        lit={lit}
        className="absolute start-0 top-3.5 md:relative md:col-start-2 md:row-start-1 md:mx-auto md:mt-4"
      >
        {toArabicDigits(index + 1)}
      </Node>
      <motion.div
        style={style}
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow] duration-300 md:row-start-1",
          side === "right" ? "md:col-start-1" : "md:col-start-3",
          open ? "border-primary/30 shadow-soft" : "border-border hover:border-primary/25",
        )}
      >
        {/* a thin brand line along the top of the open card */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-0.5 bg-gradient-brand transition-transform duration-500",
            side === "right" ? "origin-left" : "origin-right",
            open ? "scale-x-100" : "scale-x-0",
          )}
        />
        <h3>
          <button
            id={buttonId}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className="flex w-full items-center gap-4 px-5 py-4 text-start sm:px-6 sm:py-5"
          >
            <span className="flex-1 text-[15px] font-bold leading-relaxed text-foreground sm:text-base">
              {question}
            </span>
            <span
              aria-hidden
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                open
                  ? "rotate-45 border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </button>
        </h3>
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <p className="px-5 pb-5 text-sm leading-loose text-muted-foreground sm:px-6">
              {answer}
            </p>
          </div>
        </div>
      </motion.div>
    </li>
  );
}

/** The timeline's last stop: still have a question? → WhatsApp, centred under the line. */
function AskRow({ whatsappLink, mode }: { whatsappLink: string; mode: MotionMode }) {
  const ref = useRef<HTMLLIElement>(null);
  const { style, lit } = useEntrance(ref, "below", mode);
  return (
    <li ref={ref} className="relative ps-16 pt-2 md:mt-8 md:flex md:flex-col md:items-center md:ps-0">
      <Node lit={lit} className="absolute start-0 top-4 md:relative">
        ؟
      </Node>
      <motion.div
        style={style}
        className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:p-6 md:mt-4 md:w-full md:max-w-xl"
      >
        <div className="min-w-0 flex-1">
          <div className="text-base font-extrabold text-foreground">لسه عندك سؤال؟</div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            ابعتلنا على الواتساب وهنرد عليك بسرعة.
          </p>
        </div>
        <a
          href={whatsappLink || "#contact"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary shrink-0 self-start sm:self-auto"
        >
          <BtnNucleus>
            <svg viewBox="0 0 24 24" fill="currentColor">
              {IconWhatsapp}
            </svg>
          </BtnNucleus>
          كلمنا على واتساب
        </a>
      </motion.div>
    </li>
  );
}

/**
 * "Everything you need to know before you start": a centred header, then the
 * questions as stops on a timeline that fills as the student scrolls through
 * them — down the middle on wider screens with the questions alternating
 * sides (each gliding in from its own side), down the right on phones — ending
 * at the WhatsApp stop. On every screen the entrance plays once and stays.
 * Panels open with a CSS grid-rows transition (no height measuring in JS).
 */
export function Faq() {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0);
  const { faq, contact } = useSiteSettings();
  // Read after mount: the server can't know the setting, and the first client
  // render must match the server's HTML (or hydration fails with it on).
  const prefersReduced = useReducedMotion();
  const [reduce, setReduce] = useState(false);
  useEffect(() => setReduce(prefersReduced ?? false), [prefersReduced]);
  const mode: MotionMode = { reduce };

  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 75%", "end 65%"],
  });
  const line = useLatched(useSpring(scrollYProgress, SPRING));
  const full = useMotionValue(1);

  if (faq.items.length === 0) return null;

  return (
    <section id="faq" className="relative isolate scroll-mt-28 overflow-x-clip py-24 md:py-28">
      <SectionBackdrop variant="lab" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <BioBadge>الأسئلة الشائعة</BioBadge>
          <h2 className="mt-4 text-3xl font-extrabold leading-snug tracking-tight sm:text-4xl">
            كل اللي محتاج تعرفه <span className="text-primary">قبل ما تبدأ</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            جمعنالك أكتر الأسئلة اللي بتوصلنا من الطلبة وأولياء الأمور، عشان
            تبدأ رحلتك مع {SITE.teacherName} وإنت فاهم كل حاجة.
          </p>
        </motion.div>

        <ol ref={listRef} className="relative mt-14 space-y-4 sm:space-y-5 md:space-y-3">
          {/* the timeline: a faint track, and its fill that follows the scroll */}
          <span
            aria-hidden
            className="absolute start-5.25 top-6 bottom-16 w-0.5 rounded-full bg-border md:start-1/2 md:translate-x-1/2"
          />
          <motion.span
            aria-hidden
            style={{ scaleY: reduce ? full : line }}
            className="absolute start-5.25 top-6 bottom-16 w-0.5 origin-top rounded-full bg-linear-to-b from-primary to-highlight md:start-1/2 md:translate-x-1/2"
          />

          {faq.items.map((item, i) => (
            <FaqRow
              key={item.q}
              index={i}
              question={item.q}
              answer={item.a}
              open={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
              baseId={baseId}
              mode={mode}
            />
          ))}
          <AskRow whatsappLink={contact.whatsappLink} mode={mode} />
        </ol>
      </div>
    </section>
  );
}
