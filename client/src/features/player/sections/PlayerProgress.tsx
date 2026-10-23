"use client";

import { usePlayer } from "../PlayerProvider";

export function PlayerProgress() {
  const { progress } = usePlayer();
  if (!progress || progress.watchedPercentage <= 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card/60 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-bold">تقدمك في الدرس</span>
        <span className="text-primary font-bold">
          {progress.watchedPercentage}%
          {progress.isCompleted && " — مكتمل ✓"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-brand"
          style={{ width: `${progress.watchedPercentage}%` }}
        />
      </div>
    </div>
  );
}
