import { apiClient } from "./client";
import type { MeResponse, Stage, User } from "./types";

export interface RegisterPayload {
  firstName: string;
  secondName: string;
  thirdName: string;
  studentPhone: string;
  parentPhone: string;
  password: string;
  stage: Stage;
  studentVerificationCode: string;
  parentVerificationCode: string;
}

export interface LoginPayload {
  studentPhone: string;
  password: string;
}

export interface RegistrationCodesResponse {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiClient.post<{ user: User }>("/auth/register", payload),

  sendRegistrationCodes: (studentPhone: string, parentPhone: string) =>
    apiClient.post<RegistrationCodesResponse>("/auth/register/send-codes", {
      studentPhone,
      parentPhone,
    }),

  verifyRegistrationCodes: (payload: {
    studentPhone: string;
    parentPhone: string;
    studentVerificationCode: string;
    parentVerificationCode: string;
  }) =>
    apiClient.post<{ verified: boolean }>(
      "/auth/register/verify-codes",
      payload,
    ),

  login: (payload: LoginPayload) =>
    apiClient.post<{ user: User }>("/auth/login", payload),

  logout: () => apiClient.post<null>("/auth/logout"),

  refresh: () => apiClient.post<null>("/auth/refresh"),

  me: () => apiClient.get<MeResponse>("/auth/me"),

  /** Forgot password, step 1 — sends a code to the student's WhatsApp. */
  forgotPassword: (studentPhone: string) =>
    apiClient.post<RegistrationCodesResponse>("/auth/password/forgot", {
      studentPhone,
    }),

  /** Forgot password, step 2 — checks the code. */
  verifyPasswordReset: (studentPhone: string, code: string) =>
    apiClient.post<{ verified: boolean }>("/auth/password/verify", {
      studentPhone,
      code,
    }),

  /** Forgot password, step 3 — sets the new password (signs out everywhere). */
  resetPassword: (studentPhone: string, code: string, newPassword: string) =>
    apiClient.post<null>("/auth/password/reset", {
      studentPhone,
      code,
      newPassword,
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.patch<null>("/auth/change-password", {
      currentPassword,
      newPassword,
    }),
};
