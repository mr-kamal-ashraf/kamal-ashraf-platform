import { apiClient } from "../client";

export type EscalationCategory = "payment" | "complaint" | "question" | "other";
export type EscalationStatus = "open" | "resolved";

export interface EscalationItem {
  id: string;
  from_phone: string;
  student_id: string | null;
  student_name: string | null;
  category: EscalationCategory;
  summary: string;
  status: EscalationStatus;
  teacher_notified: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface EscalationsResult {
  items: EscalationItem[];
  page: number;
  limit: number;
  total: number;
  open_count: number;
}

export interface EscalationsFilters {
  status?: "open" | "resolved" | "all";
  page?: number;
  limit?: number;
}

export const adminEscalationsApi = {
  list: (filters: EscalationsFilters = {}) =>
    apiClient.get<EscalationsResult>("/admin/escalations", {
      query: filters as Record<string, string | number | undefined>,
    }),
  resolve: (id: string) =>
    apiClient.patch<{ id: string; status: EscalationStatus }>(
      `/admin/escalations/${id}/resolve`,
    ),
};
