"use client";

import { useEscalations } from "../EscalationsProvider";
import { EscalationCard } from "../components/EscalationCard";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

export function EscalationsList() {
  const { data, isLoading, error, page, setPage } = useEscalations();

  // First load: the full loading screen. A reload (search / filter / page)
  // keeps the current rows up, dimmed, until the new ones arrive.
  if (isLoading && !data) return <LoadingScreen variant="page" />;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        مفيش تصعيدات هنا دلوقتي.
      </div>
    );
  }

  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div
      aria-busy={isLoading}
      className={isLoading ? "brand-loader--refreshing space-y-4" : "space-y-4"}
    >
      <div className="grid gap-3">
        {items.map((item) => (
          <EscalationCard key={item.id} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            السابق
          </button>
          <span className="text-xs text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
