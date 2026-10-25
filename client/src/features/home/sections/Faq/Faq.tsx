"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { SITE } from "@/shared/i18n/site";
import { cn } from "@/shared/lib/cn";
import { toArabicDigits } from "@/shared/lib/arabic";
import { BioBadge, SectionBackdrop } from "@/shared/components/bio";
import { IconWhatsapp } from "@/shared/components/SiteFooter/socialIcons";
import { useSiteSettings } from "@/shared/site-settings";
import { useRevealOnce } from "@/shared/hooks/useRevealOnce";
import { BtnNucleus } from "@/shared/ui/Button";
import { Reveal } from "@/shared/ui/Reveal";

/** The hexagon each timeline node is drawn as. */
const HEX = "M22 2.5 39 12.25v19.5L22 41.5 5 31.75v-19.5Z";

/**
 * A card enters when its top is this far above the bottom of the screen. Its
 * glide, its node lighting up and the timeline filling all take the same 0.8s
 * and end together: each animation ending separately cost weak phones another
 * redraw of the page.
 */
const ENTER_AT = "0px 0px -8% 0px";

type Side = "right" | "left" | "below";

/**
 * Where a card starts its entrance (read by `.faq-card` in styles.css): from
 * its own side, slightly tilted — or from below for the last stop.
 */
function startingPoint(side: Side) {
  if (side === "below") {
    return { "--faq-x": "0px", "--faq-y": "48px", "--faq-rotate": "0deg" } as CSSProperties;
  }
  const sign = side === "right" ? 1 : -1;
  return {
    "--faq-x": `${sign * 96}px`,
    "--faq-y": "18px",
    "--faq-rotate": `${sign * 2.5}deg`,
  } as CSSProperties;
}

/**
 * A stop on the timeline: a hexagon that fills with the brand colour as its
 * card lands (eased in, ending with the card — see ENTER_AT).
 */
function Node({ lit, className, children }: { lit: boolean; className?: string; children: ReactNode }) {
  const fade = "transition-opacity duration-800 ease-in";
  return (
    <span
      aria-hidden
      data-lit={lit || undefined}
      className={cn("group relative z-10 flex size-11 shrink-0 items-center justify-center", className)}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-full">
        <path d={HEX} className="fill-card stroke-border" strokeWidth="1.5" strokeLinejoin="round" />
        <path
          d={HEX}
          className={cn("fill-primary stroke-primary opacity-0 group-data-lit:opacity-100", fade)}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={cn(
          "absolute text-sm font-black tabular-nums text-muted-foreground group-data-lit:opacity-0",
          fade,
        )}
      >
        {children}
      </span>
      <span
        className={cn(
          "absolute text-sm font-black tabular-nums text-primary-foreground opacity-0 group-data-lit:opacity-100",
          fade,
        )}
      >
        {children}
      </span>
    </span>
  );
}

/** A timeline stop that enters the first time it scrolls into view. */
function useStop(index: number, onShown: (index: number) => void) {
  const ref = useRef<HTMLLIElement>(null);
  const shown = useRevealOnce(ref, ENTER_AT);
  useEffect(() => {
    if (shown) onShown(index);
  }, [shown, index, onShown]);
  return { ref, shown };
}

function FaqRow({
  index,
  question,
  answer,
  open,
  onToggle,
  onShown,
  baseId,
}: {
  index: number;
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
  onShown: (index: number) => void;
  baseId: string;
}) {
  const { ref, shown } = useStop(index, onShown);
  // Alternating sides: 1st on the right, 2nd on the left, …
  const side = index % 2 === 0 ? "right" : "left";
  const buttonId = `${baseId}-q-${index}`;
  const panelId = `${baseId}-a-${index}`;

  return (
    <li
      ref={ref}
      className="relative ps-16 md:grid md:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] md:items-start md:ps-0"
    >
      <Node
        lit={shown}
        className="absolute start-0 top-3.5 md:relative md:col-start-2 md:row-start-1 md:mx-auto md:mt-4"
      >
        {toArabicDigits(index + 1)}
      </Node>
      <div
        data-shown={shown || undefined}
        style={startingPoint(side)}
        className={cn(
          "faq-card relative overflow-hidden rounded-2xl border bg-card md:row-start-1",
          side === "right" ? "md:col-start-1" : "md:col-start-3",
          open ? "border-primary/30 shadow-soft" : "border-border hover:border-primary/25",
        )}
      >
        {/* a thin brand line along the top of the open card */}
        {open && (
          <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-brand" />
        )}
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
                "flex size-8 shrink-0 items-center justify-center rounded-full border",
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
        {/* Opens at once and only the text fades in (`.faq-answer`). Sliding
            the height or fading colours redrew the whole page on every frame,
            and each extra animation (the icon turning, the top line growing)
            cost weak phones more frames — so everything else switches
            instantly. */}
        <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open}>
          <p className="faq-answer px-5 pb-5 text-sm leading-loose text-muted-foreground sm:px-6">
            {answer}
          </p>
        </div>
      </div>
    </li>
  );
}

/** The timeline's last stop: still have a question? → WhatsApp, centred under the line. */
function AskRow({
  index,
  whatsappLink,
  onShown,
}: {
  index: number;
  whatsappLink: string;
  onShown: (index: number) => void;
}) {
  const { ref, shown } = useStop(index, onShown);
  return (
    <li ref={ref} className="relative ps-16 pt-2 md:mt-8 md:flex md:flex-col md:items-center md:ps-0">
      <Node lit={shown} className="absolute start-0 top-4 md:relative">
        ؟
      </Node>
      <div
        data-shown={shown || undefined}
        style={startingPoint("below")}
        className="faq-card relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:p-6 md:mt-4 md:w-full md:max-w-xl"
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
      </div>
    </li>
  );
}

/**
 * "Everything you need to know before you start": a centred header, then the
 * questions as stops on a timeline — down the middle on wider screens with the
 * questions alternating sides (each gliding in from its own side), down the
 * right on phones — ending at the WhatsApp stop. Each stop enters the first
 * time it comes into view and stays; the timeline fills up to the furthest
 * stop reached. All of it is CSS transitions started by an
 * IntersectionObserver, so nothing runs while the page scrolls.
 */
export function Faq() {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0);
  const [reached, setReached] = useState(-1);
  const { faq, contact } = useSiteSettings();
  const onShown = useCallback((index: number) => setReached((r) => Math.max(r, index)), []);

  if (faq.items.length === 0) return null;
  const stops = faq.items.length + 1;

  return (
    <section id="faq" className="relative isolate scroll-mt-28 overflow-x-clip py-24 md:py-28">
      <SectionBackdrop variant="lab" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal margin="-80px" className="mx-auto max-w-2xl text-center">
          <BioBadge>الأسئلة الشائعة</BioBadge>
          <h2 className="mt-4 text-3xl font-extrabold leading-snug tracking-tight sm:text-4xl">
            كل اللي محتاج تعرفه <span className="text-primary">قبل ما تبدأ</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            جمعنالك أكتر الأسئلة اللي بتوصلنا من الطلبة وأولياء الأمور، عشان
            تبدأ رحلتك مع {SITE.teacherName} وإنت فاهم كل حاجة.
          </p>
        </Reveal>

        <ol className="relative mt-14 space-y-4 sm:space-y-5 md:space-y-3">
          {/* the timeline: a faint track, and its fill down to the furthest stop reached */}
          <span
            aria-hidden
            className="absolute start-5.25 top-6 bottom-16 w-0.5 rounded-full bg-border md:start-1/2 md:translate-x-1/2"
          />
          <span
            aria-hidden
            style={{ transform: `scaleY(${(reached + 1) / stops})` }}
            className="absolute start-5.25 top-6 bottom-16 w-0.5 origin-top rounded-full bg-linear-to-b from-primary to-highlight transition-transform duration-800 ease-out md:start-1/2 md:translate-x-1/2"
          />

          {faq.items.map((item, i) => (
            <FaqRow
              key={item.q}
              index={i}
              question={item.q}
              answer={item.a}
              open={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
              onShown={onShown}
              baseId={baseId}
            />
          ))}
          <AskRow index={faq.items.length} whatsappLink={contact.whatsappLink} onShown={onShown} />
        </ol>
      </div>
    </section>
  );
}
