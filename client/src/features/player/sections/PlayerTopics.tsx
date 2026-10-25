"use client";

import { riseIn } from "@/shared/lib/riseIn";
import { usePlayer } from "../PlayerProvider";

export function PlayerTopics() {
  const { lesson } = usePlayer();
  if (!lesson || lesson.topics.length === 0) return null;

  return (
    <div style={riseIn({ delay: 0.3, duration: 0.6 })} className="rise-in mt-10">
      <h2 className="text-xl font-extrabold">محاور الدرس</h2>
      <div className="mt-4 space-y-2">
        {lesson.topics.map((topic, i) => (
          <div
            key={`${topic}-${i}`}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-brand text-sm font-bold text-primary-foreground shadow-brand">
                {i + 1}
              </span>
              <span className="text-sm font-medium">{topic}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
