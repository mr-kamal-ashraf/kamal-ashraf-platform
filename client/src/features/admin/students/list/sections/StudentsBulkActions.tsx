"use client";

import { useStudentsList } from "../StudentsListProvider";

export function StudentsBulkActions() {
  const { selectedCount, isBulkSubmitting, clearSelection, runBulkAction } =
    useStudentsList();

  if (selectedCount === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-soft sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-4">
      <p className="text-sm font-extrabold text-foreground">
        تم تحديد {selectedCount} طالب
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runBulkAction("suspend")}
          disabled={isBulkSubmitting}
          className="min-h-[40px] rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-500/25 disabled:opacity-50"
        >
          تعليق الحسابات
        </button>
        <button
          type="button"
          onClick={() => void runBulkAction("unsuspend")}
          disabled={isBulkSubmitting}
          className="min-h-[40px] rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-500/25 disabled:opacity-50"
        >
          إعادة التفعيل
        </button>
        <button
          type="button"
          onClick={() => void runBulkAction("delete")}
          disabled={isBulkSubmitting}
          className="min-h-[40px] rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          حذف نهائي
        </button>
        <button
          type="button"
          onClick={clearSelection}
          disabled={isBulkSubmitting}
          className="min-h-[40px] rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
        >
          إلغاء التحديد
        </button>
      </div>
    </section>
  );
}
