"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { lessonsApi } from "@/api";
import type { LessonPreview } from "@/api/types";

interface LessonDetailsContextValue {
  slug: string;
  lesson: LessonPreview | null;
  related: LessonPreview[];
  isLoading: boolean;
  notFound: boolean;
}

const LessonDetailsContext = createContext<LessonDetailsContextValue | undefined>(
  undefined,
);

export function LessonDetailsProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [lesson, setLesson] = useState<LessonPreview | null>(null);
  const [allLessons, setAllLessons] = useState<LessonPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const [single, all] = await Promise.all([
          lessonsApi.getPreviewBySlug(slug),
          lessonsApi.listPreview(),
        ]);
        if (cancelled) return;
        const lessonFound = single?.lesson ?? null;
        if (!lessonFound) {
          setNotFound(true);
          setLesson(null);
        } else {
          setLesson(lessonFound);
        }
        setAllLessons(all?.lessons ?? []);
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLesson(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const related = useMemo(() => {
    if (!lesson) return [];
    return allLessons
      .filter((l) => l.stage === lesson.stage && l._id !== lesson._id)
      .slice(0, 3);
  }, [allLessons, lesson]);

  const value = useMemo<LessonDetailsContextValue>(
    () => ({ slug, lesson, related, isLoading, notFound }),
    [slug, lesson, related, isLoading, notFound],
  );

  return (
    <LessonDetailsContext.Provider value={value}>
      {children}
    </LessonDetailsContext.Provider>
  );
}

export function useLessonDetails() {
  const ctx = useContext(LessonDetailsContext);
  if (!ctx)
    throw new Error("useLessonDetails must be used within LessonDetailsProvider");
  return ctx;
}
