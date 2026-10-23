"use client";

import { useLessonsList } from "../LessonsListProvider";

export function LessonsBulkActions() {
  const { selectedCount, isBulkSubmitting, clearSelection, runBulkAction } =
    useLessonsList();
  if (selectedCount === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-soft sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-4">
      <p className="text-sm font-extrabold text-foreground">
        تم تحديد {selectedCount} درس
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void runBulkAction("publish")} disabled={isBulkSubmitting} className="min-h-[40px] rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">نشر</button>
        <button type="button" onClick={() => void runBulkAction("unpublish")} disabled={isBulkSubmitting} className="min-h-[40px] rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">إخفاء</button>
        <button type="button" onClick={() => void runBulkAction("delete")} disabled={isBulkSubmitting} className="min-h-[40px] rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-white disabled:opacity-50">حذف نهائي</button>
        <button type="button" onClick={clearSelection} disabled={isBulkSubmitting} className="min-h-[40px] rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground disabled:opacity-50">إلغاء التحديد</button>
      </div>
    </section>
  );
}
