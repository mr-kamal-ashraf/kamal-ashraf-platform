import { apiClient } from "./client";
import type { CourseCard, CourseDetailResponse } from "./types";

export const coursesApi = {
  /** Published courses for the logged-in student's own stage (+owned flag). */
  list: () => apiClient.get<{ courses: CourseCard[] }>("/courses"),

  /** Course detail with its lessons (locked unless owned). */
  getBySlug: (slug: string) =>
    apiClient.get<CourseDetailResponse>(`/courses/${slug}`),

  /** Published courses across all stages — public landing preview. */
  listPreview: () =>
    apiClient.get<{ courses: CourseCard[] }>("/courses/preview"),

  /** Opens a course with a prepaid code (أكواد الكورسات). */
  /** Opens a prepaid code's course; with courseId, only if the code is for that course. */
  redeemCode: (code: string, courseId?: string) =>
    apiClient.post<{ course: { id: string; title: string; slug: string } }>(
      "/course-codes/redeem",
      { code, courseId },
    ),
};
