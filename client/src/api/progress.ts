import { apiClient } from "./client";
import { API_URL } from "@/config/env";
import type { LessonProgressInfo } from "./types";

/**
 * The furthest second this tab has sent per lesson. A lesson reopened right
 * after leaving it resumes from here even if the save hasn't landed yet.
 */
const sentOnExit = new Map<string, number>();

export const progressApi = {
  update: (
    lessonId: string,
    lastWatchedSecond: number,
    totalSeconds?: number,
  ) =>
    apiClient.post<LessonProgressInfo>(`/progress/${lessonId}`, {
      lastWatchedSecond,
      totalSeconds,
    }),

  /**
   * The progress save, sent ONLY when the student leaves the video (another
   * page, the tab hidden, a refresh, the browser closed) — one request per
   * exit and nothing while it plays. Goes out with sendBeacon: the browser
   * delivers it even after the page is gone, and as text/plain it's a
   * "simple" request with no CORS preflight in front of it. A keepalive fetch
   * covers browsers that refuse the beacon. Best-effort: never throws.
   */
  saveOnExit: (
    lessonId: string,
    lastWatchedSecond: number,
    totalSeconds?: number,
  ): void => {
    sentOnExit.set(
      lessonId,
      Math.max(sentOnExit.get(lessonId) ?? 0, lastWatchedSecond),
    );
    const url = `${API_URL}/progress/${lessonId}`;
    const body = JSON.stringify({ lastWatchedSecond, totalSeconds });
    try {
      if (navigator.sendBeacon?.(url, body)) return;
    } catch {
      /* fall back to fetch */
    }
    try {
      void fetch(url, {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
      }).catch(() => {
        /* best-effort — losing one exit save is acceptable */
      });
    } catch {
      /* ignore */
    }
  },

  /** The furthest second this tab already sent for a lesson (0 if none). */
  sentOnExit: (lessonId: string): number => sentOnExit.get(lessonId) ?? 0,

  get: (lessonId: string) =>
    apiClient.get<LessonProgressInfo | null>(`/progress/${lessonId}`),

  listMine: () =>
    apiClient.get<{
      progress: Array<{
        lessonId: string | { _id: string; title: string; slug: string };
        lastWatchedSecond: number;
        watchedPercentage: number;
        isCompleted: boolean;
        lastWatchedAt: string;
      }>;
    }>("/progress"),
};
