import { apiClient } from "../client";
import type { AuditLogEntry, PaginatedResult } from "../types";

export interface AuditLogsFilters {
  page?: number;
  limit?: number;
  action?: string;
}

export const adminAuditLogsApi = {
  list: (filters: AuditLogsFilters = {}) =>
    apiClient.get<PaginatedResult<AuditLogEntry>>("/admin/audit-logs", {
      query: filters as Record<string, string | number | undefined>,
    }),
};
