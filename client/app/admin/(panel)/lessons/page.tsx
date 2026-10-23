import { Suspense } from "react";
import { LessonsListView } from "@/features/admin/lessons/list/LessonsListView";

/**
 * The list reads its filters from the query string (the dashboard's lesson
 * cards link here with one pre-applied), so the client view needs a Suspense
 * boundary around useSearchParams().
 */
export default function LessonsListPage() {
  return (
    <Suspense fallback={null}>
      <LessonsListView />
    </Suspense>
  );
}
