import { apiClient } from "../client";
import type { Course, CourseAdminItem, PaginatedResult, Stage } from "../types";

export interface CourseAdminFilters {
  stage?: Stage;
  search?: string;
  isPublished?: boolean;
  page?: number;
  limit?: number;
}

export interface CourseCreatePayload {
  title: string;
  /** Left out: made from the title. */
  slug?: string;
  description: string;
  /** Empty: the course page shows the short description. */
  longDescription?: string;
  stage: Stage;
  price: number;
  thumbnail?: string | null;
  thumbnailGradient?: string | null;
  order?: number;
}

export type CourseUpdatePayload = Partial<CourseCreatePayload>;

export type BulkCourseAction = "publish" | "unpublish" | "delete";

export interface BulkCourseActionResult {
  action: BulkCourseAction;
  processed: number;
  processedIds: string[];
  missingIds: string[];
  failedIds: string[];
}

export const adminCoursesApi = {
  list: (filters: CourseAdminFilters = {}) =>
    apiClient.get<PaginatedResult<CourseAdminItem>>("/admin/courses", {
      query: filters as Record<string, string | number | boolean | undefined>,
    }),

  get: (id: string) =>
    apiClient.get<{ course: Course }>(`/admin/courses/${id}`),

  create: (payload: CourseCreatePayload) =>
    apiClient.post<{ course: Course }>("/admin/courses", payload),

  /** Is this link free? (exceptId: the course being edited) */
  slugAvailable: (slug: string, exceptId?: string) =>
    apiClient.get<{ available: boolean }>("/admin/courses/slug-available", {
      query: { slug, exceptId },
    }),

  update: (id: string, payload: CourseUpdatePayload) =>
    apiClient.patch<{ course: Course }>(`/admin/courses/${id}`, payload),

  togglePublish: (id: string, isPublished: boolean) =>
    apiClient.patch<{ course: Course }>(`/admin/courses/${id}/publish`, {
      isPublished,
    }),

  delete: (id: string) => apiClient.delete<null>(`/admin/courses/${id}`),

  bulkAction: (action: BulkCourseAction, courseIds: string[]) =>
    apiClient.post<BulkCourseActionResult>("/admin/courses/bulk-action", {
      action,
      courseIds,
    }),

  uploadThumbnail: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("thumbnail", file);
    return apiClient.post<{ course: Course }>(
      `/admin/courses/${id}/thumbnail`,
      formData,
    );
  },

  clearThumbnail: (id: string) =>
    apiClient.delete<{ course: Course }>(`/admin/courses/${id}/thumbnail`),
};
