import { apiClient, isApiError } from "./client";
import { API_URL } from "@/config/env";
import type { LessonProgressInfo } from "./types";

/**
 * The furthest second this tab has sent per lesson. A lesson reopened right
 * after leaving it resumes from here even if the save hasn't landed yet.
 */
const sentOnExit = new Map<string, number>();

/*
 * A copy of how far the student got, kept in this browser while the video
 * plays — no network at all. A phone can close a backgrounded browser without
 * any event reaching the page, so no save goes out; the copy is then sent the
 * next time the student opens the site (sendLeftovers). A save that does go
 * out removes it.
 */
const BACKUP_KEY = "progress-backup";
const BACKUP_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

interface ProgressBackup {
  user: string; // whose progress — another student may sign in on this device
  second: number;
  total?: number;
  at: number;
}

function readBackups(): Record<string, ProgressBackup> {
  try {
    return JSON.parse(window.localStorage.getItem(BACKUP_KEY) || "{}") ?? {};
  } catch {
    return {};
  }
}

function writeBackups(all: Record<string, ProgressBackup>) {
  try {
    if (Object.keys(all).length > 0) window.localStorage.setItem(BACKUP_KEY, JSON.stringify(all));
    else window.localStorage.removeItem(BACKUP_KEY);
  } catch {
    // storage full or blocked — the save on leaving still works without it
  }
}

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
   * page, a refresh, the browser closed — on phones also the browser going to
   * the background) — one request per exit and nothing while it plays. Goes out with sendBeacon: the browser
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

  /** Keep a local copy of how far the student got (see BACKUP_KEY). */
  keepLocally: (userId: string, lessonId: string, second: number, total?: number) => {
    const all = readBackups();
    all[lessonId] = { user: userId, second, total, at: Date.now() };
    writeBackups(all);
  },

  /** The progress was sent: the local copy isn't needed any more. */
  forgetLocal: (lessonId: string) => {
    const all = readBackups();
    if (!all[lessonId]) return;
    delete all[lessonId];
    writeBackups(all);
  },

  /** The furthest second kept locally for this student and lesson (0 if none). */
  localFurthest: (userId: string, lessonId: string): number => {
    const backup = readBackups()[lessonId];
    return backup && backup.user === userId ? backup.second : 0;
  },

  /**
   * Sends the copies a closed browser never got to send — once, when the
   * student opens the site again. Only this student's; a copy is dropped once
   * the server has it (or refuses it for good), kept for next time if the
   * network failed.
   */
  sendLeftovers: async (userId: string) => {
    for (const [lessonId, backup] of Object.entries(readBackups())) {
      const stale = Date.now() - backup.at > BACKUP_MAX_AGE_MS;
      if (!stale && backup.user !== userId) continue;
      let done = stale;
      if (!stale) {
        try {
          await apiClient.post(`/progress/${lessonId}`, {
            lastWatchedSecond: backup.second,
            totalSeconds: backup.total,
          });
          done = true;
        } catch (err) {
          // 4xx: the server won't take it (not their course any more…) — drop it.
          done = isApiError(err) && err.statusCode >= 400 && err.statusCode < 500;
        }
      }
      if (!done) continue;
      // Unless the player wrote a newer copy meanwhile.
      const all = readBackups();
      if (all[lessonId]?.at === backup.at) {
        delete all[lessonId];
        writeBackups(all);
      }
    }
  },

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
