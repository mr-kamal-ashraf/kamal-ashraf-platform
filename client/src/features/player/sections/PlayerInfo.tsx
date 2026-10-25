"use client";

import Link from "next/link";
import { riseIn } from "@/shared/lib/riseIn";
import { StageBadge } from "@/shared/ui/StageBadge";
import { usePlayer } from "../PlayerProvider";

export function PlayerInfo() {
  const { lesson } = usePlayer();
  if (!lesson) return null;

  return (
    <div
      style={riseIn({ delay: 0.15, duration: 0.6 })}
      className="rise-in mt-6 flex flex-wrap items-start justify-between gap-4"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge stage={lesson.stage} />
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-soft">
            {lesson.durationMinutes} دقيقة
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">
          {lesson.title}
        </h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
          {lesson.longDescription}
        </p>
      </div>

      <Link
        href={`/lessons/${lesson.slug}`}
        className="btn btn-secondary shrink-0"
      >
        تفاصيل الدرس
      </Link>
    </div>
  );
}
