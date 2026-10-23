import { apiClient } from "./client";
import type {
  Lesson,
  LessonPreview,
  LessonProgressInfo,
  VideoUrlResponse,
} from "./types";

export const lessonsApi = {
  list: () => apiClient.get<{ lessons: Lesson[] }>("/lessons"),

  getBySlug: (slug: string) =>
    apiClient.get<{ lesson: Lesson; progress: LessonProgressInfo | null }>(
      `/lessons/${slug}`,
    ),

  getVideoUrl: (slug: string) =>
    apiClient.get<VideoUrlResponse>(`/lessons/${slug}/video-url`),

  listPreview: () =>
    apiClient.get<{ lessons: LessonPreview[] }>("/lessons/preview"),

  getPreviewBySlug: (slug: string) =>
    apiClient.get<{ lesson: LessonPreview } | null>(
      `/lessons/preview/${slug}`,
    ),
};
