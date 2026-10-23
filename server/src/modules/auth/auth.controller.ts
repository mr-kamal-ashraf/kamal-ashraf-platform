import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import {
  setStudentAuthCookies,
  clearStudentAuthCookies,
} from "../../shared/utils/cookies";
import { COOKIE_NAMES, ENROLLMENT_STATUS } from "../../config/constants";
import { ApiError } from "../../shared/utils/ApiError";
import * as authService from "./auth.service";
import { sendRegistrationWelcome } from "../notifications/whatsapp.client";
import { User } from "../users/user.model";
import { Enrollment } from "../enrollments/enrollment.model";
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  RegistrationVerificationRequestInput,
  RegistrationVerificationCheckInput,
  PasswordResetRequestInput,
  PasswordResetCheckInput,
  PasswordResetInput,
} from "./auth.validation";

/** Extracts device metadata from the request for session tracking. */
function getMeta(req: Request) {
  return {
    userAgent: req.get("user-agent") || "",
    ipAddress: req.ip || req.socket.remoteAddress || "",
  };
}

/** Sends separate WhatsApp verification codes to the student and parent phones. */
export async function sendRegistrationCodes(req: Request, res: Response) {
  const input = req.body as RegistrationVerificationRequestInput;
  const result = await authService.sendRegistrationVerificationCodes(input);
  return sendSuccess(res, {
    message: "تم إرسال كود للطالب وكود لولي الأمر على واتساب.",
    data: result,
  });
}

/** Checks the two WhatsApp codes before the wizard advances to the next step. */
export async function verifyRegistrationCodes(req: Request, res: Response) {
  const input = req.body as RegistrationVerificationCheckInput;
  await authService.verifyRegistrationVerificationCodes(input);
  return sendSuccess(res, {
    message: "تم تأكيد الكودين بنجاح.",
    data: { verified: true },
  });
}

/**
 * POST /auth/register
 * Creates a new student account and immediately logs them in
 * (issues cookies) so they don't have to log in separately.
 * Account is inactive until the admin activates it.
 */
export async function register(req: Request, res: Response) {
  const input = req.body as RegisterInput;
  const user = await authService.registerStudent(input);

  // Auto-login: issue tokens so the student enters the platform immediately
  const meta = getMeta(req);
  const { tokens } = await authService.loginStudentAfterRegister(user, meta);

  setStudentAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  // Fire-and-forget: friendly WhatsApp welcome to the student AND the parent.
  // Never awaited (must not delay the response) and never throws (failures are
  // logged inside the bridge; a dormant bridge is a safe no-op).
  void sendRegistrationWelcome({
    studentPhone: user.studentPhone,
    parentPhone: user.parentPhone,
    studentName:
      `${user.firstName} ${user.secondName} ${user.thirdName}`.trim(),
  });

  return sendSuccess(res, {
    statusCode: 201,
    message:
      "تم التسجيل بنجاح. حسابك محتاج تفعيل من الأستاذ عشان تشاهد الدروس.",
    data: {
      user: user.toJSON(),
    },
  });
}

/**
 * POST /auth/login
 * Authenticates a student and sets HttpOnly auth cookies on success.
 */
export async function login(req: Request, res: Response) {
  const input = req.body as LoginInput;
  const meta = getMeta(req);

  const result = await authService.loginStudent(input, meta);

  setStudentAuthCookies(
    res,
    result.tokens.accessToken,
    result.tokens.refreshToken,
  );

  return sendSuccess(res, {
    message: "تم تسجيل الدخول بنجاح",
    data: {
      user: result.user.toJSON(),
    },
  });
}

/**
 * POST /auth/refresh
 * Reads the refresh token from the HttpOnly cookie, verifies it, and
 * issues a new access + refresh token pair (token rotation).
 */
export async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
  if (!refreshToken) {
    throw ApiError.unauthorized(
      "الجلسة انتهت، سجّل الدخول تاني.",
      "NO_REFRESH_TOKEN",
    );
  }

  const result = await authService.refreshStudentSession(refreshToken);
  setStudentAuthCookies(res, result.accessToken, result.refreshToken);

  return sendSuccess(res, { message: "تم تجديد الجلسة" });
}

/**
 * POST /auth/logout
 * Revokes the student's session in the DB and clears the auth cookies.
 * Works even if called without a valid token (best-effort logout).
 */
export async function logout(req: Request, res: Response) {
  await authService.logoutStudent(req.user?.sessionId);
  clearStudentAuthCookies(res);
  return sendSuccess(res, { message: "تم تسجيل الخروج" });
}

/**
 * GET /auth/me
 * Returns the currently authenticated student's profile. Access to courses is
 * by ownership (Enrollment) and is fetched via the courses endpoints, so there
 * is no subscription block here any more.
 */
export async function me(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();

  const [user, hasOwnedCourse] = await Promise.all([
    User.findById(req.user.id),
    Enrollment.exists({
      userId: req.user.id,
      status: ENROLLMENT_STATUS.ACTIVE,
    }),
  ]);
  if (!user) throw ApiError.notFound("المستخدم غير موجود");

  return sendSuccess(res, {
    data: {
      user: { ...user.toJSON(), hasOwnedCourse: Boolean(hasOwnedCourse) },
    },
  });
}

/**
 * PATCH /auth/change-password
 * Lets the student change their own password after verifying the current one.
 */
export async function changePassword(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
  await authService.changeStudentPassword(
    req.user.id,
    currentPassword,
    newPassword,
    req.user.sessionId,
  );
  return sendSuccess(res, { message: "تم تغيير كلمة السر" });
}

/** POST /auth/password/forgot — sends a reset code to the student's WhatsApp. */
export async function forgotPassword(req: Request, res: Response) {
  const result = await authService.requestPasswordReset(
    req.body as PasswordResetRequestInput,
  );
  return sendSuccess(res, {
    message: "بعتنالك كود على واتساب.",
    data: result,
  });
}

/** POST /auth/password/verify — checks the code before the new-password step. */
export async function verifyPasswordReset(req: Request, res: Response) {
  await authService.verifyPasswordResetCode(
    req.body as PasswordResetCheckInput,
  );
  return sendSuccess(res, {
    message: "الكود صحيح.",
    data: { verified: true },
  });
}

/** POST /auth/password/reset — sets the new password and signs out everywhere. */
export async function resetPassword(req: Request, res: Response) {
  await authService.resetStudentPassword(req.body as PasswordResetInput);
  return sendSuccess(res, {
    message: "تم تغيير كلمة السر. ادخل بكلمة السر الجديدة.",
  });
}
