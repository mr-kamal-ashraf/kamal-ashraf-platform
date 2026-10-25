"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

/*
 * The capsule appears like a dynamic island: a small pill in the middle of the
 * bar that stretches out to wrap the logo and buttons while it fades in, then
 * one soft sheen crosses it. Leaving the top reverses it (shrinks back to the
 * middle, then fades). Only the absolutely-positioned capsule animates — the
 * bar's content never moves or resizes. Docking also lifts the WHOLE bar 6px
 * toward the top edge, so it reads as one object settling into place. All of
 * it is CSS (`.site-header*` in styles.css): the page's JavaScript only flips
 * `data-docked` when the page leaves or reaches the top.
 */

/** Same width and padding as every page section, so the nav lines up with them. */
const CONTAINER = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

/**
 * The content answers the capsule: the logo and each button give one soft
 * pulse at the moment the glass edge sweeps past them — centre first while it
 * grows (delays follow the capsule's ease-out), edges first while it shrinks.
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

  // Returning the same boolean is a no-op, so React re-renders only at the
  // moment the capsule shows or hides. The reading bar under the capsule
  // follows the scroll in CSS (a scroll-driven animation); browsers without
  // those get it set from here instead.
  const [scrolled, setScrolled] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setReduceMotion(matchMedia("(prefers-reduced-motion: reduce)").matches);
    const bar = progressRef.current;
    const cssDriven = CSS.supports("animation-timeline: scroll()");
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled((prev) => (prev ? y > HIDE_AT : y > SHOW_AT));
      if (cssDriven || !bar) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const barRef = useRef<HTMLDivElement>(null);
  useDockWave(barRef, scrolled, reduceMotion);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      data-docked={scrolled || undefined}
      className="site-header sticky top-0 z-50 w-full pt-3 sm:pt-4"
    >
      <div className={cn(CONTAINER, "site-header__bar")}>
        <div className="relative">
          {/* The capsule. At the top of the page the nav floats bare over the
            hero; when it docks the capsule grows out of the middle of the bar.
            It is absolutely positioned, so its animation never reflows the
            bar's content. Nearly opaque instead of a frosted blur: blurring
            what scrolls under a sticky bar is redone on every frame, which
            weak phones can't keep up with. */}
          <div
            aria-hidden
            className="site-header__capsule pointer-events-none absolute inset-y-0 overflow-hidden rounded-full border border-border/80 bg-card/95 shadow-soft"
          >
            {scrolled && !reduceMotion && (
              <span className="site-header__sheen absolute inset-0 bg-[linear-gradient(100deg,transparent_35%,rgb(255_255_255/0.5)_50%,transparent_65%)] opacity-60 dark:opacity-20" />
            )}
            <div
              ref={progressRef}
              className="site-header__progress absolute bottom-0 left-0 h-0.5 w-full origin-left bg-primary/70"
            />
          </div>

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

      {open && (
        <div
          style={{ "--rise-y": "-8px", "--rise-duration": "0.2s" } as CSSProperties}
          className={cn(CONTAINER, "rise-in md:hidden")}
        >
          <div className="mt-2 rounded-3xl border border-border bg-card p-3 shadow-elegant">
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
        </div>
      )}
    </header>
  );
}
