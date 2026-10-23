import { apiClient } from "../client";
import type {
  CommitmentLevel,
  PaginatedResult,
  Stage,
  StudentDetail,
  User,
} from "../types";

export interface StudentFilters {
  search?: string;
  stage?: Stage;
  status?: "active" | "pending" | "suspended" | "expired";
  /** This month's commitment band; results come back most-committed first. */
  commitment?: CommitmentLevel;
  page?: number;
  limit?: number;
}

export type BulkStudentAction = "suspend" | "unsuspend" | "delete";

export interface BulkStudentActionResult {
  action: BulkStudentAction;
  requested: number;
  processed: number;
  missingIds: string[];
  failedIds: string[];
}

export const adminStudentsApi = {
  list: (filters: StudentFilters = {}) =>
    apiClient.get<PaginatedResult<User>>("/admin/students", {
      query: filters as Record<string, string | number | undefined>,
    }),

  get: (id: string) => apiClient.get<StudentDetail>(`/admin/students/${id}`),

  suspend: (id: string) =>
    apiClient.post<{ user: User }>(`/admin/students/${id}/suspend`),

  unsuspend: (id: string) =>
    apiClient.post<{ user: User }>(`/admin/students/${id}/unsuspend`),

  resetPassword: (id: string, newPassword: string) =>
    apiClient.post<null>(`/admin/students/${id}/reset-password`, {
      newPassword,
    }),

  grantCourse: (id: string, courseId: string, notes?: string) =>
    apiClient.post<{ enrollment: unknown }>(
      `/admin/students/${id}/courses/${courseId}/grant`,
      { notes },
    ),

  revokeCourse: (id: string, courseId: string) =>
    apiClient.delete<null>(`/admin/students/${id}/courses/${courseId}`),

  revokeSession: (studentId: string, sessionId: string) =>
    apiClient.delete<null>(
      `/admin/students/${studentId}/sessions/${sessionId}`,
    ),

  deleteStudent: (id: string) =>
    apiClient.delete<null>(`/admin/students/${id}`),

  bulkAction: (action: BulkStudentAction, studentIds: string[]) =>
    apiClient.post<BulkStudentActionResult>("/admin/students/bulk-action", {
      action,
      studentIds,
    }),
};
