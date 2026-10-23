import { Suspense } from "react";
import { StudentsListView } from "@/features/admin/students/list/StudentsListView";

/**
 * The list reads its filters from the query string (dashboard cards link here
 * with one pre-applied), so the client view needs a Suspense boundary around
 * useSearchParams().
 */
export default function StudentsListPage() {
  return (
    <Suspense fallback={null}>
      <StudentsListView />
    </Suspense>
  );
}
