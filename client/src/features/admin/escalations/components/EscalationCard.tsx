"use client";

import type { EscalationItem } from "@/api/admin/escalations";
import { useEscalations } from "../EscalationsProvider";

const CATEGORY_LABELS: Record<EscalationItem["category"], string> = {
  payment: "فلوس / دفع",
  complaint: "شكوى",
  question: "سؤال",
  other: "أخرى",
};

const CATEGORY_STYLES: Record<EscalationItem["category"], string> = {
  payment: "bg-amber-500/10 text-amber-600",
  complaint: "bg-red-500/10 text-red-600",
  question: "bg-blue-500/10 text-blue-600",
  other: "bg-muted text-muted-foreground",
};

export function EscalationCard({ item }: { item: EscalationItem }) {
  const { resolve, resolvingId } = useEscalations();
  const isResolving = resolvingId === item.id;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              "rounded-full px-2.5 py-1 text-[11px] font-bold " +
              CATEGORY_STYLES[item.category]
            }
          >
            {CATEGORY_LABELS[item.category]}
          </span>
          {item.status === "resolved" ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
              مُحلّة
            </span>
          ) : (
            <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-600">
              مفتوحة
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {new Date(item.created_at).toLocaleString("ar-EG")}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-foreground">
        {item.summary}
      </p>

      <dl className="mt-3 grid gap-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">الطالب</dt>
          <dd className="truncate font-bold">{item.student_name || "غير معروف"}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">الرقم</dt>
          <dd dir="ltr" className="font-mono text-muted-foreground">
            {item.from_phone}
          </dd>
        </div>
      </dl>

      {item.status === "open" && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => resolve(item.id)}
            disabled={isResolving}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {isResolving ? "جارٍ..." : "وضع كمُحلّ"}
          </button>
        </div>
      )}
    </div>
  );
}
