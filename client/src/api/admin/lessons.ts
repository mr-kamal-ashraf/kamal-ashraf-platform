import { apiClient, type UploadOptions } from "../client";
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
  /** Left out: made from the title. */
  slug?: string;
  description: string;
  /** Empty: the lesson page shows the short description. */
  longDescription?: string;
  /** Left out: taken from the video once it's uploaded. */
  durationMinutes?: number;
  /** The duration follows the video's real length. */
  durationAuto?: boolean;
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
  durationAuto: boolean;
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
  /** Video still being prepared: published by itself once it's ready. */
  scheduledIds: string[];
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

  /**
   * Publish or hide. `whenReady`: a video still being prepared doesn't refuse
   * it — the lesson gets published by itself once the video is ready.
   */
  togglePublish: (id: string, isPublished: boolean, { whenReady = false } = {}) =>
    apiClient.patch<{ lesson: Lesson }>(`/admin/lessons/${id}/publish`, {
      isPublished,
      whenReady,
    }),

  /** A course's lessons in the order students see them (all of them). */
  reorder: (courseId: string, lessonIds: string[]) =>
    apiClient.put<null>("/admin/lessons/order", { courseId, lessonIds }),

  delete: (id: string) => apiClient.delete<null>(`/admin/lessons/${id}`),

  bulkAction: (action: BulkLessonAction, lessonIds: string[]) =>
    apiClient.post<BulkLessonActionResult>("/admin/lessons/bulk-action", {
      action,
      lessonIds,
    }),

  /** Reports how much went out (`onProgress`) — a video can take minutes. */
  uploadVideo: (id: string, file: File, options?: UploadOptions) => {
    const formData = new FormData();
    formData.append("video", file);
    return apiClient.upload<{ lesson: Lesson }>(
      `/admin/lessons/${id}/video`,
      formData,
      options,
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
