"use client";

import { useStudentsList } from "../StudentsListProvider";

export function StudentsPagination() {
  const { data, page, setPage } = useStudentsList();
  if (!data || data.totalPages <= 1) return null;

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <span className="text-xs text-muted-foreground">
        عرض {data.items.length} من إجمالي {data.total}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="min-h-[40px] rounded-lg border border-border px-4 py-1.5 text-xs font-bold disabled:opacity-50"
        >
          السابق
        </button>
        <span className="text-xs font-bold">
          صفحة {data.page} / {data.totalPages}
        </span>
        <button
          onClick={() => setPage(Math.min(data.totalPages, page + 1))}
          disabled={page === data.totalPages}
          className="min-h-[40px] rounded-lg border border-border px-4 py-1.5 text-xs font-bold disabled:opacity-50"
        >
          التالي
        </button>
      </div>
    </div>
  );
}
