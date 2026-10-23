import { API_URL } from "@/config/env";
import { apiClient } from "../client";

/**
 * Prepaid course codes (أكواد الكورسات): the teacher generates a batch for a
 * course, prints or exports it, and sells the codes offline; a student types
 * one on the course page and the course opens.
 */

export type CourseCodeStatus = "available" | "used" | "disabled";

export interface CourseCodeItem {
  id: string;
  code: string;
  status: CourseCodeStatus;
  price: number;
  batchId: string;
  batchLabel: string | null;
  createdAt: string;
  usedAt: string | null;
  usedBy: { id: string; name: string; studentPhone: string } | null;
}

export interface CourseCodeBatch {
  batchId: string;
  label: string | null;
  price: number;
  total: number;
  used: number;
  createdAt: string;
}

export interface CourseCodesResult {
  items: CourseCodeItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: { available: number; used: number; disabled: number; total: number };
  batches: CourseCodeBatch[];
}

export interface CourseCodeFilters {
  courseId: string;
  status?: CourseCodeStatus;
  batchId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GenerateCodesPayload {
  courseId: string;
  count: number;
  /** Omit to use the course's current price. */
  price?: number;
  label?: string;
}

export interface GeneratedCodes {
  batchId: string;
  course: { id: string; title: string };
  price: number;
  label: string | null;
  codes: string[];
}

type QueryRecord = Record<string, string | number | undefined>;

function queryString(
  filters: Omit<CourseCodeFilters, "page" | "limit" | "search">,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "")
      params.append(key, String(value));
  }
  return params.toString();
}

export const adminCourseCodesApi = {
  list: (filters: CourseCodeFilters) =>
    apiClient.get<CourseCodesResult>("/admin/course-codes", {
      query: filters as unknown as QueryRecord,
    }),

  generate: (payload: GenerateCodesPayload) =>
    apiClient.post<GeneratedCodes>("/admin/course-codes", payload),

  setDisabled: (id: string, disabled: boolean) =>
    apiClient.patch<{ id: string; status: CourseCodeStatus }>(
      `/admin/course-codes/${id}`,
      { disabled },
    ),

  /** Removes codes for good (they stop working); students who used one keep the course. */
  remove: (codeIds: string[]) =>
    apiClient.post<{ deleted: number }>("/admin/course-codes/bulk-delete", {
      codeIds,
    }),

  /** Codes + course title for the print sheet (no paging). */
  printData: (filters: Omit<CourseCodeFilters, "page" | "limit" | "search">) =>
    apiClient.get<{ courseTitle: string; items: CourseCodeItem[] }>(
      "/admin/course-codes/print",
      { query: filters as unknown as QueryRecord },
    ),

  /**
   * Absolute URL of the CSV export. Returned as a URL rather than fetched so
   * the browser downloads it as a file, with the admin cookie riding along.
   */
  exportUrl: (filters: Omit<CourseCodeFilters, "page" | "limit" | "search">) =>
    `${API_URL}/admin/course-codes/export?${queryString(filters)}`,
};
