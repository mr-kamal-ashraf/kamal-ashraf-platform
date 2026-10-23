import type { Metadata } from "next";
import { resolveAssetUrl } from "@/config/env";
import { CourseDetailView } from "@/features/courses/CourseDetailView";
import { STAGE_LONG_LABELS } from "@/shared/lib/stage";
import { JsonLd } from "@/shared/seo/JsonLd";
import { OG_IMAGE, pageOpenGraph } from "@/shared/seo/seo";
import { getPublicCourse } from "@/shared/seo/public-data";
import { courseGraph } from "@/shared/seo/structured-data";

type PageProps = { params: Promise<{ slug: string }> };

/** The course's own title, description, canonical URL and share card. */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicCourse(slug);
  if (!data) return { title: "الكورس", robots: { index: false } };

  const { course } = data;
  const description = (
    course.description ||
    course.longDescription ||
    `كورس ${course.title} — ${STAGE_LONG_LABELS[course.stage]}`
  ).slice(0, 300);
  const thumb = resolveAssetUrl(course.thumbnail);
  const images = thumb ? [{ url: thumb, alt: course.title }] : [OG_IMAGE];
  const title = `${course.title} — ${STAGE_LONG_LABELS[course.stage]}`;
  return {
    title,
    description,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: pageOpenGraph({
      url: `/courses/${course.slug}`,
      title,
      description,
      images,
    }),
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default async function CoursePage({ params }: PageProps) {
  const { slug } = await params;
  // The public view (lessons locked) is rendered on the server, so the course's
  // title, description and lesson list are in the HTML for search engines; the
  // student's own state (owned, pending payment) is filled in on the client.
  const data = await getPublicCourse(slug);
  return (
    <>
      {data && <JsonLd data={courseGraph(data)} />}
      <CourseDetailView slug={slug} initialData={data} />
    </>
  );
}
