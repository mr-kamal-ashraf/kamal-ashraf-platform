import type { Metadata } from "next";
import { LessonDetailsView } from "@/features/lessons/details/LessonDetailsView";
import { API_URL } from "@/config/env";
import { pageOpenGraph } from "@/shared/seo/seo";

type PageProps = { params: Promise<{ slug: string }> };

async function fetchLessonPreview(slug: string) {
  try {
    const res = await fetch(
      `${API_URL}/lessons/preview/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data: { lesson: { title: string; description: string } } | null;
    };
    return json.data?.lesson ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lesson = await fetchLessonPreview(slug);
  if (!lesson) {
    return { title: "الدرس غير موجود" };
  }

  return {
    title: lesson.title,
    description: lesson.description,
    alternates: { canonical: `/lessons/${slug}` },
    openGraph: pageOpenGraph({
      type: "article",
      url: `/lessons/${slug}`,
      title: lesson.title,
      description: lesson.description,
    }),
  };
}

export default async function LessonPage({ params }: PageProps) {
  const { slug } = await params;
  return <LessonDetailsView slug={slug} />;
}
