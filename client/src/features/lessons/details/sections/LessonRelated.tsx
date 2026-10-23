"use client";

import Link from "next/link";
import { resolveAssetUrl } from "@/config/env";
import { getLessonGradient } from "@/shared/lib/stage";
import { StageBadge } from "@/shared/ui/StageBadge";
import { CoverArt } from "@/shared/components/bio";
import { useLessonDetails } from "../LessonDetailsProvider";

export function LessonRelated() {
  const { related } = useLessonDetails();
  if (related.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-extrabold sm:text-3xl">
        دروس تانية في نفس المرحلة
      </h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((r) => {
          const rGradient = getLessonGradient(r.stage, r.thumbnailGradient);
          const rThumbnail = resolveAssetUrl(r.thumbnail);
          return (
            <Link
              key={r._id}
              href={`/lessons/${r.slug}`}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-brand"
            >
              <div
                className="relative aspect-video w-full overflow-hidden"
                style={{ background: rGradient }}
              >
                {rThumbnail ? (
                  <img
                    src={rThumbnail}
                    alt={r.title}
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <CoverArt seed={r.slug} glyphClassName="size-24" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent" />
                <div className="absolute inset-x-3 top-3">
                  <StageBadge stage={r.stage} />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold group-hover:text-primary">
                  {r.title}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                  {r.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
