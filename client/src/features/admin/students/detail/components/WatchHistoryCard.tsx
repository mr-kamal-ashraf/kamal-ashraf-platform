import { STAGE_LABELS } from "@/shared/lib/stage";
import { formatSeconds } from "@/shared/lib/arabic";
import type { WatchHistoryItem } from "@/api/types";

export function WatchHistoryCard({ item }: { item: WatchHistoryItem }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-foreground">
            {item.lessonId?.title ?? "—"}
          </div>
          {item.lessonId && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {STAGE_LABELS[item.lessonId.stage]}
            </div>
          )}
        </div>
        {item.isCompleted ? (
          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
            ✓ مكتمل
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            مش مكتمل
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">نسبة المشاهدة</span>
          <span className="font-bold text-primary">
            {item.watchedPercentage}%
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-brand"
            style={{ width: `${item.watchedPercentage}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        <span>وقف عند: {formatSeconds(item.lastWatchedSecond)}</span>
        <span>{new Date(item.lastWatchedAt).toLocaleDateString("ar-EG")}</span>
      </div>
    </div>
  );
}
