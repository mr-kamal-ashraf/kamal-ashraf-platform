"use client";

import { SiteFooter } from "@/shared/components/SiteFooter";
import { SiteHeader } from "@/shared/components/SiteHeader";
import { PageBackdrop } from "@/shared/components/bio";
import { LessonDetailsHero } from "./sections/LessonDetailsHero";
import { LessonNotFound } from "./sections/LessonNotFound";
import { LessonRelated } from "./sections/LessonRelated";
import { LessonTopicsAndAccess } from "./sections/LessonTopicsAndAccess";
import {
  LessonDetailsProvider,
  useLessonDetails,
} from "./LessonDetailsProvider";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

function LessonDetailsContent() {
  const { isLoading, notFound } = useLessonDetails();

  if (isLoading) return <LoadingScreen variant="page" />;

  if (notFound) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <LessonNotFound />
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="relative">
        <PageBackdrop />
        <LessonDetailsHero />
        <LessonTopicsAndAccess />
        <LessonRelated />
      </main>
      <SiteFooter />
    </div>
  );
}

export function LessonDetailsView({ slug }: { slug: string }) {
  return (
    <LessonDetailsProvider slug={slug}>
      <LessonDetailsContent />
    </LessonDetailsProvider>
  );
}
