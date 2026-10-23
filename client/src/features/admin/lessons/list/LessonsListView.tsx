"use client";

import { LessonsListProvider } from "./LessonsListProvider";
import { LessonsFilters } from "./sections/LessonsFilters";
import { LessonsListHeader } from "./sections/LessonsListHeader";
import { LessonsTable } from "./sections/LessonsTable";
import { LessonsBulkActions } from "./sections/LessonsBulkActions";

export function LessonsListView() {
  return (
    <LessonsListProvider>
      <div className="space-y-5 sm:space-y-6">
        <LessonsListHeader />
        <LessonsFilters />
        <LessonsBulkActions />
        <LessonsTable />
      </div>
    </LessonsListProvider>
  );
}
