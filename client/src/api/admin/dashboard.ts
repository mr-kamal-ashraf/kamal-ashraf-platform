import { apiClient } from "../client";
import type { DashboardStats } from "../types";

export const adminDashboardApi = {
  stats: () => apiClient.get<DashboardStats>("/admin/dashboard"),
};
