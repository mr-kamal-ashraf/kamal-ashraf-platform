import { API_URL } from "@/config/env";
import type {
  CourseCard,
  CourseDetailResponse,
  LessonPreview,
} from "@/api/types";

/*
 * Server-only reads of the PUBLIC catalogue (what a guest — or Google — may
 * see) for metadata, structured data, the sitemap and the course page's first
 * render. Cached for REVALIDATE seconds; any failure returns empty so a page
 * never breaks because the API is down.
 */
const REVALIDATE = 600;

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** A course page as a guest sees it (lessons locked), or null. */
export function getPublicCourse(slug: string) {
  return get<CourseDetailResponse>(`/courses/${encodeURIComponent(slug)}`);
}

/** Every published course, all stages. */
export async function listPublicCourses(): Promise<CourseCard[]> {
  return (
    (await get<{ courses: CourseCard[] }>("/courses/preview"))?.courses ?? []
  );
}

/** Every published lesson that has a public preview page. */
export async function listPublicLessons(): Promise<LessonPreview[]> {
  return (
    (await get<{ lessons: LessonPreview[] }>("/lessons/preview"))?.lessons ?? []
  );
}
