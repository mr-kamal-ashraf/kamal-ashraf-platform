import { SITE } from "@/shared/i18n/site";
import { MarqueeDivider } from "./MarqueeDivider";

export function Marquee() {
  const phrases = SITE.marqueePhrases;
  const repetitions = 5;

  return (
    <section
      className="relative overflow-hidden border-y border-primary/15 py-3"
      style={{
        background:
          "linear-gradient(90deg, color-mix(in oklab, var(--primary) 7%, transparent), color-mix(in oklab, var(--highlight) 8%, transparent), color-mix(in oklab, var(--primary) 7%, transparent))",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 40%, transparent), transparent)",
        }}
      />

      <div className="flex w-max animate-marquee items-center gap-6 whitespace-nowrap">
        {Array.from({ length: repetitions }).flatMap((_, repIdx) =>
          phrases.map((phrase, phraseIdx) => (
            <div
              key={`${repIdx}-${phraseIdx}`}
              className="flex items-center gap-6"
            >
              <span className="text-base font-extrabold text-primary sm:text-lg">
                {phrase}
              </span>
              <MarqueeDivider index={repIdx * phrases.length + phraseIdx} />
            </div>
          )),
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-20"
        style={{
          background:
            "linear-gradient(to left, var(--background), transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-20"
        style={{
          background:
            "linear-gradient(to right, var(--background), transparent)",
        }}
      />
    </section>
  );
}
