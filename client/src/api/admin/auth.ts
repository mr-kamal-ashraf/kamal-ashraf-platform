import { apiClient } from "../client";
import type { Admin } from "../types";

export interface AdminLoginPayload {
  email: string;
  password: string;
}

export const adminAuthApi = {
  login: (payload: AdminLoginPayload) =>
    apiClient.post<{ admin: Admin }>("/admin/auth/login", payload),

  logout: () => apiClient.post<null>("/admin/auth/logout"),

  refresh: () => apiClient.post<null>("/admin/auth/refresh"),

  me: () => apiClient.get<{ admin: Admin }>("/admin/auth/me"),

  /** Changes the signed-in admin's password; other devices get signed out. */
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiClient.patch<null>("/admin/auth/change-password", payload),
};
