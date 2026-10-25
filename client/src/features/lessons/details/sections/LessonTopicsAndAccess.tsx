"use client";

import Link from "next/link";
import { useLessonDetails } from "../LessonDetailsProvider";
import { BtnNucleus } from "@/shared/ui/Button";
import { Reveal } from "@/shared/ui/Reveal";

export function LessonTopicsAndAccess() {
  const { lesson } = useLessonDetails();
  if (!lesson) return null;

  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:px-8">
      <div className="lg:col-span-2">
        <h2 className="text-2xl font-extrabold sm:text-3xl">تفاصيل الدرس:</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {lesson.topics.map((topic, i) => (
            <Reveal
              as="li"
              key={`${i}-${topic}`}
              shift={20}
              rise={0}
              margin="0px"
              delay={i * 0.08}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/40"
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-primary-foreground">
                ✓
              </span>
              <span className="text-sm leading-relaxed">{topic}</span>
            </Reveal>
          ))}
        </ul>
      </div>

      <aside className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card p-6 shadow-elegant">
        <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-brand" />

        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-brand">
          <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-extrabold">الوصول للدرس</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          الدرس ده جزء من كورس. اشترِ الكورس وهيتفتحلك على طول وتقدر تتفرّج
          على دروسه في أي وقت.
        </p>
        <Link
          href="/courses"
          className="btn btn-primary mt-5 w-full"
        >
          <BtnNucleus />
          تصفّح الكورسات
        </Link>
      </aside>
    </section>
  );
}
