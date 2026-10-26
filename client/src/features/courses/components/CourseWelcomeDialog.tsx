"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSiteSettings } from "@/shared/site-settings";
import { BtnNucleus } from "@/shared/ui/Button";
import { CourseWelcomeCard } from "./CourseWelcomeCard";

/** Confetti pieces: angle (deg), distance (px), color, shape — fixed, so every burst matches. */
const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  angle: (360 / 22) * i + (i % 3) * 7,
  distance: 120 + (i % 4) * 34,
  color: ["var(--primary)", "#f59e0b", "#10b981", "#38bdf8", "#f472b6"][i % 5],
  round: i % 2 === 0,
}));

/**
 * The welcome a student gets on a course they just opened (paid, code or
 * free): a congratulation by name, a motivating line, and the first lesson
 * one tap away. The texts are the teacher's (site settings → welcome).
 */
export function CourseWelcomeDialog({
  open,
  firstName,
  courseTitle,
  line,
  firstLessonSlug,
  onClose,
}: {
  open: boolean;
  firstName?: string;
  courseTitle: string;
  line: string | null;
  firstLessonSlug?: string;
  onClose: () => void;
}) {
  const { welcome } = useSiteSettings();
  const reduceMotion = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus the popup itself (no ring on a button the student didn't pick);
    // Tab reaches the buttons.
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          onClick={onClose}
        >
          {!reduceMotion && (
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2"
            >
              {CONFETTI.map((piece, i) => {
                const rad = (piece.angle * Math.PI) / 180;
                return (
                  <motion.span
                    key={i}
                    className="absolute block size-2.5"
                    style={{
                      background: piece.color,
                      borderRadius: piece.round ? "9999px" : "2px",
                    }}
                    initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
                    animate={{
                      x: Math.cos(rad) * piece.distance,
                      y: Math.sin(rad) * piece.distance + 40,
                      scale: 1,
                      opacity: [1, 1, 0],
                      rotate: piece.angle * 2,
                    }}
                    transition={{ duration: 1.5, delay: 0.15, ease: "easeOut" }}
                  />
                );
              })}
            </div>
          )}

          <motion.div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            className="card-strata relative w-full max-w-md overflow-hidden rounded-3xl p-7 text-center outline-none sm:p-8"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 16 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <CourseWelcomeCard
              title={welcome.title}
              message={welcome.message}
              line={line}
              firstName={firstName}
              courseTitle={courseTitle}
              titleId="welcome-title"
            >
              {firstLessonSlug ? (
                <Link
                  href={`/player/${firstLessonSlug}`}
                  className="btn btn-primary flex-1"
                >
                  <BtnNucleus />
                  ابدأ أول درس
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-primary flex-1"
                >
                  <BtnNucleus />
                  تمام
                </button>
              )}
              {firstLessonSlug && (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                >
                  بعدين
                </button>
              )}
            </CourseWelcomeCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
