import { Suspense } from "react";
import { SalesView } from "@/features/admin/sales/SalesView";

/**
 * The report reads its filters from the query string (the dashboard's sales
 * cards link here with a date range applied), so the client view needs a
 * Suspense boundary around useSearchParams().
 */
export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesView />
    </Suspense>
  );
}
