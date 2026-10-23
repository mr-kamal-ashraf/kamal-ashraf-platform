import { API_URL } from "@/config/env";
import { apiClient } from "../client";
import type { Stage } from "../types";

/**
 * Sales report (قسم المبيعات).
 *
 * A "sale" here is a course ownership record, which is the only place online
 * Paymob payments and cash sales the teacher took in person both appear. A
 * report built on the payments table alone would hide every cash sale.
 */

export type SaleSource = "paymob" | "cash" | "code";
export type SaleStatus = "active" | "revoked";

export interface SaleItem {
  id: string;
  student: {
    id: string;
    name: string;
    studentPhone: string;
    parentPhone: string;
    stage: Stage;
  } | null;
  course: { id: string; title: string; stage: Stage } | null;
  amount: number;
  currency: string;
  source: SaleSource;
  status: SaleStatus;
  soldAt: string;
  revokedAt: string | null;
  notes: string | null;
  transactionRef: string | null;
}

export interface SalesListResult {
  items: SaleItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Revenue of every ACTIVE sale matching the filters, not just this page. */
  filteredRevenue: number;
}

export interface SalesSummary {
  currency: string;
  totalRevenue: number;
  monthRevenue: number;
  todayRevenue: number;
  cashRevenue: number;
  onlineRevenue: number;
  /** Opened with prepaid course codes (priced at what each code sold for). */
  codeRevenue: number;
  salesCount: number;
  monthSalesCount: number;
  averageSale: number;
  revokedCount: number;
  revokedAmount: number;
  /** Unfinished online checkouts inside the recent window below. */
  pendingAttempts: number;
  failedAttempts: number;
  attemptsWindowDays: number;
  topCourses: { id: string; title: string; salesCount: number; revenue: number }[];
}

export interface SalesFilters {
  search?: string;
  source?: SaleSource;
  status?: SaleStatus;
  stage?: Stage;
  courseId?: string;
  /** Inclusive yyyy-mm-dd bounds on the sale date. */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/** Query object shaped the way apiClient expects it. */
type QueryRecord = Record<string, string | number | undefined>;

export const adminSalesApi = {
  list: (filters: SalesFilters = {}) =>
    apiClient.get<SalesListResult>("/admin/sales", {
      query: filters as QueryRecord,
    }),

  summary: () => apiClient.get<SalesSummary>("/admin/sales/summary"),

  /**
   * Absolute URL of the CSV export for the current filters.
   *
   * Returned as a URL rather than fetched: the browser must follow it itself
   * so the download arrives as a file with its Content-Disposition name, and
   * the admin cookie rides along with it.
   */
  exportUrl: (filters: Omit<SalesFilters, "page" | "limit"> = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    }
    const query = params.toString();
    return `${API_URL}/admin/sales/export${query ? `?${query}` : ""}`;
  },
};
