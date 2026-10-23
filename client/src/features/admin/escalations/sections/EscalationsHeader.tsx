"use client";

import { useEscalations } from "../EscalationsProvider";

const TABS: { key: "open" | "resolved" | "all"; label: string }[] = [
  { key: "open", label: "المفتوحة" },
  { key: "resolved", label: "المُحلّة" },
  { key: "all", label: "الكل" },
];

export function EscalationsHeader() {
  const { status, setStatus, data } = useEscalations();
  const openCount = data?.open_count ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
            تصعيدات الدعم
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            الحالات اللي وكيل الواتساب حوّلها ليك عشان تتصرف فيها
          </p>
        </div>
        {openCount > 0 && (
          <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-600">
            {openCount} مفتوحة
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={
              "rounded-full px-4 py-1.5 text-xs font-bold transition " +
              (status === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
