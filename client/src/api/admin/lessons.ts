import { apiClient } from "../client";
import type { Lesson, LessonVideoStatus, PaginatedResult, Stage } from "../types";

export interface LessonAdminFilters {
  courseId?: string;
  stage?: Stage;
  search?: string;
  isPublished?: boolean;
  page?: number;
  limit?: number;
}

export interface LessonCreatePayload {
  courseId: string;
  title: string;
  slug: string;
  description: string;
  longDescription: string;
  durationMinutes: number;
  chapters?: number;
  topics?: string[];
  thumbnail?: string | null;
  thumbnailGradient?: string | null;
  order?: number;
}

export type LessonUpdatePayload = Partial<{
  courseId: string;
  title: string;
  slug: string;
  description: string;
  longDescription: string;
  durationMinutes: number;
  chapters: number;
  topics: string[];
  thumbnail: string | null;
  thumbnailGradient: string | null;
  order: number;
}>;

export type BulkLessonAction = "publish" | "unpublish" | "delete";

export interface BulkLessonActionResult {
  action: BulkLessonAction;
  processed: number;
  processedIds: string[];
  missingIds: string[];
  failedIds: string[];
}

export const adminLessonsApi = {
  list: (filters: LessonAdminFilters = {}) =>
    apiClient.get<PaginatedResult<Lesson>>("/admin/lessons", {
      query: filters as Record<string, string | number | boolean | undefined>,
    }),

  get: (id: string) =>
    apiClient.get<{ lesson: Lesson }>(`/admin/lessons/${id}`),

  /** Whether Bunny has finished converting the lesson video. */
  videoStatus: (id: string) =>
    apiClient.get<LessonVideoStatus>(`/admin/lessons/${id}/video-status`),

  create: (payload: LessonCreatePayload) =>
    apiClient.post<{ lesson: Lesson }>("/admin/lessons", payload),

  /** Is this link free? (exceptId: the lesson being edited) */
  slugAvailable: (slug: string, exceptId?: string) =>
    apiClient.get<{ available: boolean }>("/admin/lessons/slug-available", {
      query: { slug, exceptId },
    }),

  update: (id: string, payload: LessonUpdatePayload) =>
    apiClient.patch<{ lesson: Lesson }>(`/admin/lessons/${id}`, payload),

  togglePublish: (id: string, isPublished: boolean) =>
    apiClient.patch<{ lesson: Lesson }>(`/admin/lessons/${id}/publish`, {
      isPublished,
    }),

  delete: (id: string) => apiClient.delete<null>(`/admin/lessons/${id}`),

  bulkAction: (action: BulkLessonAction, lessonIds: string[]) =>
    apiClient.post<BulkLessonActionResult>("/admin/lessons/bulk-action", {
      action,
      lessonIds,
    }),

  uploadVideo: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("video", file);
    return apiClient.post<{ lesson: Lesson }>(
      `/admin/lessons/${id}/video`,
      formData,
    );
  },

  uploadThumbnail: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("thumbnail", file);
    return apiClient.post<{ lesson: Lesson }>(
      `/admin/lessons/${id}/thumbnail`,
      formData,
    );
  },

  clearThumbnail: (id: string) =>
    apiClient.delete<{ lesson: Lesson }>(`/admin/lessons/${id}/thumbnail`),
};
