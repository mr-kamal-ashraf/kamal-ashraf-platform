"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { isApiError, lessonsApi, progressApi } from "@/api";
import type { ApiError } from "@/api/client";
import type { Lesson, LessonProgressInfo } from "@/api/types";
import { useAuth } from "@/features/auth/AuthContext";
import type { LoginRequiredReason } from "@/features/lessons/popups/login-required-config";

interface BlockerState {
  open: boolean;
  reason: LoginRequiredReason;
  message?: string;
}

/** Why the video can't play right now — shown in the player's place. */
export interface VideoNotice {
  kind: "processing" | "failed";
  message: string;
}

interface PlayerContextValue {
  slug: string;
  lesson: Lesson | null;
  progress: LessonProgressInfo | null;
  videoUrl: string | null;
  loading: boolean;
  blocker: BlockerState;
  closeBlocker: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoNotice: VideoNotice | null;
  /** Asks for the video again (a fresh signed link). */
  retryVideo: () => Promise<void>;
  retrying: boolean;
  /** Bumped by every retry, so the player rebuilds even if the link came back the same. */
  videoAttempt: number;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

/** The video-url refusals that keep the lesson page and explain in the player. */
function videoNoticeFrom(err: ApiError): VideoNotice | null {
  if (err.code === "VIDEO_PROCESSING") return { kind: "processing", message: err.message };
  if (err.code === "VIDEO_FAILED") return { kind: "failed", message: err.message };
  return null;
}

export function PlayerProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<LessonProgressInfo | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoNotice, setVideoNotice] = useState<VideoNotice | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [videoAttempt, setVideoAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [blocker, setBlocker] = useState<BlockerState>({
    open: false,
    reason: "guest",
  });

  const handleApiError = useCallback((err: ApiError) => {
    const notice = videoNoticeFrom(err);
    if (notice) {
      setVideoNotice(notice);
    } else if (err.statusCode === 401) {
      setBlocker({ open: true, reason: "guest" });
    } else if (err.code === "NOT_ENROLLED") {
      // The student doesn't own this lesson's course — send them to buy it.
      const details = err.details as { courseSlug?: string | null } | undefined;
      const courseSlug = details?.courseSlug;
      router.push(courseSlug ? `/courses/${courseSlug}` : "/courses");
    } else if (err.code === "STAGE_MISMATCH") {
      setBlocker({
        open: true,
        reason: "stage-mismatch",
        message: err.message,
      });
    } else if (err.code === "NO_VIDEO") {
      setBlocker({ open: true, reason: "no-video", message: err.message });
    } else {
      setBlocker({ open: true, reason: "generic-error", message: err.message });
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setBlocker({ open: true, reason: "guest" });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setVideoNotice(null);
    setVideoUrl(null);

    (async () => {
      try {
        const lessonResult = await lessonsApi.getBySlug(slug);
        if (cancelled) return;
        setLesson(lessonResult.lesson);
        // A save sent moments ago (leaving this lesson and coming straight
        // back) may not have reached the server yet — resume from it anyway.
        const sentHere = progressApi.sentOnExit(lessonResult.lesson._id);
        const stored = lessonResult.progress;
        setProgress(
          sentHere > (stored?.lastWatchedSecond ?? 0)
            ? {
                watchedPercentage: 0,
                isCompleted: false,
                ...stored,
                lastWatchedSecond: sentHere,
              }
            : stored,
        );

        const urlResult = await lessonsApi.getVideoUrl(slug);
        if (cancelled) return;
        setVideoUrl(urlResult.url);
      } catch (err) {
        if (cancelled) return;
        if (isApiError(err)) {
          handleApiError(err);
        } else {
          setBlocker({
            open: true,
            reason: "generic-error",
            message: "حصل خطأ أثناء تحميل الدرس",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, isAuthenticated, authLoading, handleApiError]);

  const retryVideo = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const urlResult = await lessonsApi.getVideoUrl(slug);
      setVideoNotice(null);
      setVideoUrl(urlResult.url);
      setVideoAttempt((n) => n + 1);
    } catch (err) {
      const notice = isApiError(err) ? videoNoticeFrom(err) : null;
      setVideoNotice(
        notice ?? {
          kind: "failed",
          message: isApiError(err)
            ? err.message
            : "مقدرناش نوصل للفيديو — راجع الإنترنت وجرّب تاني.",
        },
      );
    } finally {
      setRetrying(false);
    }
  }, [slug, retrying]);

  // Watch progress reaches the server ONLY when the student leaves the video:
  // another page, the tab hidden (switching tabs/apps, locking the phone), a
  // refresh, or the browser closed. While it plays, the furthest point is just
  // kept here in memory — no requests at all — so a full lesson costs one
  // request per exit, however long it is.
  useEffect(() => {
    if (loading || !lesson || !videoUrl) return;

    const lessonId = lesson._id;
    // Only getting further than the server already has is worth a request.
    let saved = Math.max(progress?.lastWatchedSecond ?? 0, progressApi.sentOnExit(lessonId));
    let furthest = 0;
    let duration = 0;
    let video: HTMLVideoElement | null = null;
    let cancelled = false;
    let rafId = 0;
    let attachAttempts = 0;

    // Read from the element while it plays: when the player is torn down the
    // element is reset to a blank clip, so reading it on exit would say 0.
    // (max() keeps that blank clip's short duration from replacing the real one.)
    const onTimeUpdate = () => {
      if (!video) return;
      furthest = Math.max(furthest, Math.floor(video.currentTime));
      if (Number.isFinite(video.duration)) {
        duration = Math.max(duration, Math.floor(video.duration));
      }
    };

    const save = () => {
      if (furthest <= saved) return; // nothing new since the last save
      saved = furthest;
      progressApi.saveOnExit(lessonId, furthest, duration || undefined);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };

    const tryAttach = () => {
      if (cancelled) return;
      const el = videoRef.current;
      if (!el) {
        attachAttempts += 1;
        if (attachAttempts < 600) {
          rafId = requestAnimationFrame(tryAttach);
        }
        return;
      }
      video = el;
      video.addEventListener("timeupdate", onTimeUpdate);
    };

    rafId = requestAnimationFrame(tryAttach);

    // visibilitychange covers switching tabs or apps and locking the phone;
    // pagehide covers a refresh and closing the tab or browser.
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
      video?.removeEventListener("timeupdate", onTimeUpdate);
      save(); // leaving within the site (another page, another lesson)
      video = null;
    };
  }, [lesson, loading, videoUrl, progress]);

  const closeBlocker = useCallback(() => {
    setBlocker((b) => ({ ...b, open: false }));
    router.push("/");
  }, [router]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      slug,
      lesson,
      progress,
      videoUrl,
      loading: loading || authLoading,
      blocker,
      closeBlocker,
      videoRef,
      videoNotice,
      retryVideo,
      retrying,
      videoAttempt,
    }),
    [
      slug,
      lesson,
      progress,
      videoUrl,
      loading,
      authLoading,
      blocker,
      closeBlocker,
      videoNotice,
      retryVideo,
      retrying,
      videoAttempt,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
