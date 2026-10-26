"use client";

import { useCallback, useRef, useState } from "react";

export interface UploadProgress {
  sent: number;
  total: number;
  /** Bytes a second, smoothed — for "how long is left". */
  speed: number;
  /** When the upload started (ms, performance.now). */
  startedAt: number;
}

/**
 * Follows an upload's progress events (they fire many times a second) and
 * re-renders at most ~4 times a second with how much went out and how fast.
 */
export function useUploadProgress() {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const last = useRef<{ at: number; sent: number; speed: number; shownAt: number; startedAt: number } | null>(null);

  const start = useCallback(() => {
    const now = performance.now();
    last.current = { at: now, sent: 0, speed: 0, shownAt: now, startedAt: now };
    setProgress({ sent: 0, total: 0, speed: 0, startedAt: now });
  }, []);

  const onProgress = useCallback((sent: number, total: number) => {
    const now = performance.now();
    const prev = last.current ?? { at: now, sent: 0, speed: 0, shownAt: 0, startedAt: now };
    let speed = prev.speed;
    if (now - prev.at >= 200) {
      const instant = ((sent - prev.sent) * 1000) / (now - prev.at);
      speed = speed ? speed * 0.7 + instant * 0.3 : instant;
      last.current = { ...prev, at: now, sent, speed };
    }
    if (sent >= total || now - prev.shownAt >= 250) {
      last.current = { ...(last.current ?? prev), shownAt: now };
      setProgress({ sent, total, speed, startedAt: prev.startedAt });
    }
  }, []);

  const reset = useCallback(() => {
    last.current = null;
    setProgress(null);
  }, []);

  return { progress, start, onProgress, reset };
}

/** 734003200 → "700 ميجا", 1610612736 → "1.5 جيجا". */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} جيجا`;
  if (mb >= 10) return `${Math.round(mb)} ميجا`;
  return `${mb.toFixed(1)} ميجا`;
}

/** What's left, in plain words — null while it's too early to tell. */
export function formatTimeLeft(progress: UploadProgress): string | null {
  const elapsed = performance.now() - progress.startedAt;
  if (elapsed < 3000 || progress.speed <= 0 || progress.total <= 0) return null;
  const seconds = (progress.total - progress.sent) / progress.speed;
  if (seconds < 60) return "باقي أقل من دقيقة";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `باقي حوالي ${minutesWord(minutes)}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `باقي حوالي ${hours === 1 ? "ساعة" : `${hours} ساعات`}${rest ? ` و${minutesWord(rest)}` : ""}`;
}

/** 1 → "دقيقة", 2 → "دقيقتين", 5 → "5 دقايق", 20 → "20 دقيقة". */
function minutesWord(n: number): string {
  if (n === 1) return "دقيقة";
  if (n === 2) return "دقيقتين";
  return n <= 10 ? `${n} دقايق` : `${n} دقيقة`;
}
