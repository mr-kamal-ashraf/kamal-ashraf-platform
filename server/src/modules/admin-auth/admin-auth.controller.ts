import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import {
  setAdminAuthCookies,
  clearAdminAuthCookies,
} from "../../shared/utils/cookies";
import { COOKIE_NAMES } from "../../config/constants";
import { ApiError } from "../../shared/utils/ApiError";
import * as adminAuthService from "./admin-auth.service";
import { Admin } from "../admins/admin.model";
import { recordAuditLog } from "../audit-logs/audit-log.service";
import { AUDIT_ACTIONS } from "../audit-logs/audit-log.model";
import type {
  AdminChangePasswordInput,
  AdminLoginInput,
} from "./admin-auth.validation";

/** Extracts IP address and user-agent from the request for session metadata. */
function getMeta(req: Request) {
  return {
    userAgent: req.get("user-agent") || "",
    ipAddress: req.ip || req.socket.remoteAddress || "",
  };
}

/**
 * POST /admin/auth/login
 * Authenticates an admin, sets HttpOnly auth cookies, and records an audit log entry.
 */
export async function login(req: Request, res: Response) {
  const input = req.body as AdminLoginInput;
  const meta = getMeta(req);

  const result = await adminAuthService.loginAdmin(input, meta);
  setAdminAuthCookies(res, result.accessToken, result.refreshToken);

  await recordAuditLog({
    adminId: result.admin._id,
    action: AUDIT_ACTIONS.ADMIN_LOGIN,
    metadata: { sessionId: result.sessionId },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return sendSuccess(res, {
    message: "تم تسجيل الدخول",
    data: {
      admin: result.admin.toJSON(),
    },
  });
}

/**
 * POST /admin/auth/refresh
 * Issues a new admin token pair from the stored refresh cookie.
 */
export async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies?.[COOKIE_NAMES.ADMIN_REFRESH_TOKEN];
  if (!refreshToken) {
    throw ApiError.unauthorized("الجلسة انتهت، سجّل الدخول تاني.", "NO_REFRESH_TOKEN");
  }

  const result = await adminAuthService.refreshAdminSession(refreshToken);
  setAdminAuthCookies(res, result.accessToken, result.refreshToken);

  return sendSuccess(res, { message: "تم تجديد الجلسة" });
}

/**
 * POST /admin/auth/logout
 * Revokes the admin session, clears auth cookies, and records an audit log entry.
 */
export async function logout(req: Request, res: Response) {
  if (req.user) {
    await recordAuditLog({
      adminId: req.user.id,
      action: AUDIT_ACTIONS.ADMIN_LOGOUT,
      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
    });
  }
  await adminAuthService.logoutAdmin(req.user?.sessionId);
  clearAdminAuthCookies(res);
  return sendSuccess(res, { message: "تم تسجيل الخروج" });
}

/**
 * PATCH /admin/auth/change-password
 * Changes the signed-in admin's password, signs out their other devices and
 * records an audit log entry.
 */
export async function changePassword(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const { currentPassword, newPassword } = req.body as AdminChangePasswordInput;
  const meta = getMeta(req);

  await adminAuthService.changeAdminPassword(
    req.user.id,
    currentPassword,
    newPassword,
    req.user.sessionId
  );

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.CHANGE_ADMIN_PASSWORD,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return sendSuccess(res, {
    message: "تم تغيير كلمة السر، وتم تسجيل الخروج من الأجهزة التانية",
  });
}

/**
 * GET /admin/auth/me
 * Returns the currently authenticated admin's profile.
 */
export async function me(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const admin = await Admin.findById(req.user.id);
  if (!admin) throw ApiError.notFound("الأدمن غير موجود");
  return sendSuccess(res, { data: { admin: admin.toJSON() } });
}
