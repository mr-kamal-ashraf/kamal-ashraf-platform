interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  totalLabel?: string;
}

export function Pagination({
  page,
  totalPages,
  onChange,
  totalLabel,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      {totalLabel && (
        <span className="text-xs text-muted-foreground">{totalLabel}</span>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="min-h-[40px] rounded-lg border border-border px-4 py-1.5 text-xs font-bold disabled:opacity-50"
        >
          السابق
        </button>
        <span className="text-xs font-bold">
          صفحة {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="min-h-[40px] rounded-lg border border-border px-4 py-1.5 text-xs font-bold disabled:opacity-50"
        >
          التالي
        </button>
      </div>
    </div>
  );
}
