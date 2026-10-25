"use client";

import Link from "next/link";
import { riseIn } from "@/shared/lib/riseIn";
import { usePlayer } from "../PlayerProvider";

export function PlayerBreadcrumb() {
  const { lesson } = usePlayer();
  if (!lesson) return null;

  return (
    <nav
      style={riseIn({ y: 0, duration: 0.4 })}
      className="rise-in mb-5 flex items-center gap-2 text-sm text-muted-foreground"
    >
      <Link href="/" className="hover:text-primary">
        الرئيسية
      </Link>
      <span>/</span>
      <Link href={`/lessons/${lesson.slug}`} className="hover:text-primary">
        {lesson.title}
      </Link>
      <span>/</span>
      <span className="font-semibold text-foreground">المشاهدة</span>
    </nav>
  );
}
