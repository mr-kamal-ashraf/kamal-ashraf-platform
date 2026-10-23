import type { MetadataRoute } from "next";
import { resolveAssetUrl } from "@/config/env";
import { absoluteUrl } from "@/shared/seo/seo";
import { listPublicCourses, listPublicLessons } from "@/shared/seo/public-data";

/** Rebuilt at most hourly, so new courses and lessons reach Google on their own. */
export const revalidate = 3600;

/**
 * /sitemap.xml — every public page: home, the courses page, sign-up / login,
 * the terms page,
 * each published course and each lesson's public preview page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, lessons] = await Promise.all([
    listPublicCourses(),
    listPublicLessons(),
  ]);
  const now = new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/courses"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    { url: absoluteUrl("/register"), changeFrequency: "yearly", priority: 0.5 },
    { url: absoluteUrl("/login"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
    ...courses.map((course) => {
      const image = resolveAssetUrl(course.thumbnail);
      return {
        url: absoluteUrl(`/courses/${course.slug}`),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.9,
        ...(image ? { images: [image] } : {}),
      };
    }),
    ...lessons.map((lesson) => ({
      url: absoluteUrl(`/lessons/${lesson.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
