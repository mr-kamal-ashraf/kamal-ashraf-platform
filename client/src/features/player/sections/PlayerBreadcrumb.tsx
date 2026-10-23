"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePlayer } from "../PlayerProvider";

export function PlayerBreadcrumb() {
  const { lesson } = usePlayer();
  if (!lesson) return null;

  return (
    <motion.nav
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-5 flex items-center gap-2 text-sm text-muted-foreground"
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
    </motion.nav>
  );
}
