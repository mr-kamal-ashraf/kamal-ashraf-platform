"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import { toast } from "sonner";
import { SITE } from "@/shared/i18n/site";
import { BrandLogo } from "../BrandLogo";
import { cn } from "@/shared/lib/cn";
import { useAuth } from "@/features/auth/AuthContext";
import { BioIcon, type BioIconName } from "../bio";
import { ThemeToggle } from "../ThemeToggle";
import { useSiteSettings } from "@/shared/site-settings";
import { BtnNucleus } from "@/shared/ui/Button";

const MOBILE_LINKS: Array<{ href: string; label: string; icon: BioIconName }> =
  [
    { href: "/", label: "الرئيسية", icon: "sprout" },
    { href: "/courses", label: "الكورسات", icon: "book" },
    { href: "/#why", label: "ليه تختارنا", icon: "spark" },
  ];

/**
 * The capsule shows once the page has scrolled past SHOW_AT and hides again
 * only above HIDE_AT. The gap keeps touch scrolling / iOS bounce near the top
 * from toggling it back and forth.
 */
const SHOW_AT = 24;
const HIDE_AT = 8;
const CAPSULE_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The capsule appears like a dynamic island: a small pill in the middle of the
 * bar that stretches out to wrap the logo and buttons while it fades in, then
 * one soft sheen crosses the glass. Leaving the top reverses it (shrinks back
 * to the middle, then fades). Only the absolutely-positioned glass layer
 * animates — the bar's content never moves or resizes.
 */
const CAPSULE_FULL = { left: "calc(0% - 0px)", right: "calc(0% - 0px)" };
const CAPSULE_PILL = {
  left: "calc(50% - 40px)",
  right: "calc(50% - 40px)",
};
const CAPSULE_IN = {
  default: { duration: 0.6, ease: CAPSULE_EASE },
  opacity: { duration: 0.25, ease: "easeOut" },
} as const;
const CAPSULE_OUT = {
  default: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
  opacity: { duration: 0.25, delay: 0.1, ease: "easeIn" },
} as const;

/**
 * Docking: on scroll the WHOLE bar (logo, buttons and capsule together) rises
 * DOCK_RISE px toward the top edge while its glass background fades in, so it
 * reads as one object settling into place rather than a layer sliding behind
 * still content. A slightly over-damped spring: eases in and out naturally
 * and settles in ~0.3s with no bounce.
 */
const DOCK_RISE = 6;
const DOCK_SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 42,
  mass: 0.9,
} as const;

/** Same width and padding as every page section, so the nav lines up with them. */
const CONTAINER = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

/**
 * The content answers the capsule: the logo and each button give one soft
 * pulse at the moment the glass edge sweeps past them — centre first while it
 * grows (delay follows CAPSULE_IN's ease-out), edges first while it shrinks.
 * Uses the standalone CSS `scale` property through the Web Animations API, so
 * it never fights the buttons' own hover transforms and leaves no inline style
 * behind.
 */
const WAVE_PULSE = [{ scale: 1 }, { scale: 1.06 }, { scale: 1 }];

function useDockWave(
  barRef: RefObject<HTMLDivElement | null>,
  docked: boolean,
  off: boolean,
) {
  const wasDocked = useRef(false);
  useEffect(() => {
    if (!docked && !wasDocked.current) return; // still at the top since load
    wasDocked.current = true;
    const bar = barRef.current;
    if (!bar || off) return;
    const box = bar.getBoundingClientRect();
    const mid = box.left + box.width / 2;
    // The logo and every control in the right-hand group.
    bar
      .querySelectorAll<HTMLElement>(":scope > a, :scope > div > *")
      .forEach((item) => {
        const r = item.getBoundingClientRect();
        if (!r.width) return; // hidden at this breakpoint
        const reach = Math.min(
          1,
          Math.abs(r.left + r.width / 2 - mid) / (box.width / 2),
        );
        item.animate(WAVE_PULSE, {
          duration: 420,
          delay: docked ? 600 * (1 - (1 - reach) ** 0.25) : (1 - reach) * 300,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
      });
  }, [barRef, docked, off]);
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { allowModeToggle } = useSiteSettings().theme;
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("تم تسجيل الخروج");
      router.push("/");
    } catch {
      toast.error("حصل خطأ أثناء تسجيل الخروج");
    }
  };

  const { scrollY, scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 25,
    mass: 0.3,
  });

  // Reuses framer's scroll tracking. Returning the same boolean is a no-op,
  // so React re-renders only at the moment the capsule shows or hides.
  const reduceMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled((prev) => (prev ? y > HIDE_AT : y > SHOW_AT));
  });
  const barRef = useRef<HTMLDivElement>(null);
  useDockWave(barRef, scrolled, !!reduceMotion);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{
        y: scrolled && !reduceMotion ? -DOCK_RISE : 0,
        opacity: 1,
      }}
      transition={{
        y: DOCK_SPRING,
        opacity: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
      }}
      className="sticky top-0 z-50 w-full pt-3 sm:pt-4"
    >
      <div className={CONTAINER}>
        <div className="relative">
          {/* The glass capsule. At the top of the page the nav floats bare over
            the hero; when it docks the capsule grows out of the middle of the
            bar (CAPSULE_*). It is absolutely positioned, so its animation
            never reflows the bar's content. */}
          <motion.div
            aria-hidden
            initial={false}
            animate={
              scrolled
                ? { opacity: 1, ...CAPSULE_FULL }
                : {
                    opacity: 0,
                    ...(reduceMotion ? CAPSULE_FULL : CAPSULE_PILL),
                  }
            }
            transition={scrolled ? CAPSULE_IN : CAPSULE_OUT}
            className="pointer-events-none absolute inset-y-0 overflow-hidden rounded-full border border-border/80 bg-card/90 shadow-soft backdrop-blur-md"
          >
            {scrolled && !reduceMotion && (
              <motion.span
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ delay: 0.3, duration: 1.1, ease: "easeInOut" }}
                className="absolute inset-0 bg-[linear-gradient(100deg,transparent_35%,rgb(255_255_255/0.5)_50%,transparent_65%)] opacity-60 dark:opacity-20"
              />
            )}
            <motion.div
              style={{ scaleX }}
              className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-primary/70"
            />
          </motion.div>

          <div
            ref={barRef}
            dir="ltr"
            className="relative flex h-16 items-center justify-between gap-3 pl-4 pr-3 sm:h-20 sm:pl-6 sm:pr-4"
          >
            <Link
              href="/"
              aria-label={SITE.brandShort}
              className="group flex items-center"
            >
              <BrandLogo className="h-14 transition-transform group-hover:scale-[1.04] sm:h-16" />
            </Link>

            <div className="flex items-center gap-2">
              {allowModeToggle && <ThemeToggle />}

              <Link
                href="/courses"
                dir="rtl"
                className="btn btn-secondary hidden md:inline-flex"
              >
                الكورسات
              </Link>

              {!isLoading && !isAuthenticated && (
                <>
                  <Link
                    href="/login"
                    dir="rtl"
                    className="btn btn-secondary hidden md:inline-flex"
                  >
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    تسجيل دخول
                  </Link>

                  <Link
                    href="/register"
                    dir="rtl"
                    className="btn btn-primary hidden md:inline-flex"
                  >
                    <BtnNucleus>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="23" y1="11" x2="17" y2="11" />
                      </svg>
                    </BtnNucleus>
                    انشاء حساب
                  </Link>
                </>
              )}

              {!isLoading && isAuthenticated && user && (
                <>
                  <Link
                    href="/profile"
                    dir="rtl"
                    className="btn btn-secondary hidden md:inline-flex"
                  >
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="max-w-[120px] truncate">
                      {user.firstName}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    title="تسجيل خروج"
                    aria-label="تسجيل خروج"
                    className="btn btn-danger btn-icon hidden md:inline-flex"
                  >
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </button>
                </>
              )}

              <button
                type="button"
                aria-label="فتح القائمة"
                onClick={() => setOpen((v) => !v)}
                className="btn btn-secondary btn-icon md:hidden"
              >
                <svg
                  className={`size-5 transition-transform ${open ? "rotate-90" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {open ? (
                    <path d="M18 6L6 18M6 6l12 12" />
                  ) : (
                    <>
                      <path d="M4 6h16" />
                      <path d="M4 12h16" />
                      <path d="M4 18h16" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={cn(CONTAINER, "md:hidden")}
          >
            <div className="mt-2 rounded-3xl border border-border bg-card/95 p-3 shadow-elegant backdrop-blur-md">
              <nav className="flex flex-col gap-1">
                {MOBILE_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
                      pathname === link.href
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BioIcon name={link.icon} className="size-4" />
                    </span>
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
                {!isAuthenticated ? (
                  <>
                    <Link href="/login" className="btn btn-secondary">
                      تسجيل دخول
                    </Link>

                    <Link href="/register" className="btn btn-primary">
                      انشاء حساب
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/profile" className="btn btn-secondary">
                      حسابي
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="btn btn-danger"
                    >
                      تسجيل خروج
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
