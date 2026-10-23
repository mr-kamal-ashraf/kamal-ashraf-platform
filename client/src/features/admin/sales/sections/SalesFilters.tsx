"use client";

import type { Stage } from "@/api/types";
import {
  useSales,
  type SalesSourceFilter,
  type SalesStatusFilter,
} from "../SalesProvider";
import { STAGE_LIST } from "@/shared/lib/stage";

const FIELD_CLASSES =
  "min-h-[44px] rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none";

export function SalesFilters() {
  const {
    search,
    source,
    status,
    stage,
    from,
    to,
    setSearch,
    setSource,
    setStatus,
    setStage,
    setFrom,
    setTo,
    resetFilters,
    hasFilters,
  } = useSales();

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input
          type="text"
          placeholder="ابحث باسم الطالب أو رقمه أو اسم الكورس..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${FIELD_CLASSES} focus:ring-1 focus:ring-primary`}
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as SalesSourceFilter)}
          className={FIELD_CLASSES}
        >
          <option value="">كل طرق الدفع</option>
          <option value="paymob">أونلاين</option>
          <option value="cash">كاش</option>
          <option value="code">كود</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SalesStatusFilter)}
          className={FIELD_CLASSES}
        >
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="revoked">ملغي</option>
        </select>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as "" | Stage)}
          className={FIELD_CLASSES}
        >
          <option value="">كل المراحل</option>
          {STAGE_LIST.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
            من تاريخ
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={FIELD_CLASSES}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
            إلى تاريخ
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={FIELD_CLASSES}
          />
        </label>
        {hasFilters ? (
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-[44px] self-end rounded-xl border border-border px-4 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            مسح الفلاتر
          </button>
        ) : null}
      </div>
    </div>
  );
}
