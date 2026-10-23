"use client";

import { useSales } from "../SalesProvider";

export function SalesHeader() {
  const { data, exportUrl } = useSales();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
          المبيعات
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          كل عمليات البيع — الأونلاين والكاش — في مكان واحد
          {data ? ` · ${data.total.toLocaleString("ar-EG")} عملية` : ""}
        </p>
      </div>

      {/*
        A plain link, not a fetch: the browser has to follow it itself so the
        file arrives with its Content-Disposition name and the admin cookie.
      */}
      <a
        href={exportUrl}
        // A new tab so that an expired session shows its error there instead of
        // replacing the report; a successful download closes the tab itself.
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-bold text-foreground transition-colors hover:border-primary/40"
      >
        تصدير Excel (CSV)
      </a>
    </div>
  );
}
