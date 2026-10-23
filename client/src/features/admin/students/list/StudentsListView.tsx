"use client";

import { StudentsListProvider } from "./StudentsListProvider";
import { StudentsFilters } from "./sections/StudentsFilters";
import { StudentsListHeader } from "./sections/StudentsListHeader";
import { StudentsPagination } from "./sections/StudentsPagination";
import { StudentsTable } from "./sections/StudentsTable";
import { StudentsBulkActions } from "./sections/StudentsBulkActions";

export function StudentsListView() {
  return (
    <StudentsListProvider>
      <div className="space-y-5 sm:space-y-6">
        <StudentsListHeader />
        <StudentsFilters />
        <StudentsBulkActions />
        <StudentsTable />
        <StudentsPagination />
      </div>
    </StudentsListProvider>
  );
}
