"use client";

import { AuditLogsProvider } from "./AuditLogsProvider";
import { AuditLogsHeader } from "./sections/AuditLogsHeader";
import { AuditLogsPagination } from "./sections/AuditLogsPagination";
import { AuditLogsTable } from "./sections/AuditLogsTable";

export function AuditLogsView() {
  return (
    <AuditLogsProvider>
      <div className="space-y-5 sm:space-y-6">
        <AuditLogsHeader />
        <AuditLogsTable />
        <AuditLogsPagination />
      </div>
    </AuditLogsProvider>
  );
}
