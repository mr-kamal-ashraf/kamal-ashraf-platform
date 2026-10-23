import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { Admin, type AdminDocument } from "../admins/admin.model";
import { ApiError } from "../../shared/utils/ApiError";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../shared/utils/jwt";
import { env } from "../../config/env";
import { ROLES } from "../../config/constants";
import {
  createSession,
  findSessionByRefreshToken,
  findSessionByAnyRefreshHash,
  findSessionJustRotatedFrom,
  rotateSession,
  revokeSession,
  revokeAllUserSessions,
  revokeOtherUserSessions,
} from "../sessions/session.service";
import type { AdminLoginInput } from "./admin-auth.validation";
import { logger } from "../../shared/utils/logger";
import {
  clearLoginAttempts,
  lockAccount,
  takeLoginAttempt,
} from "../../shared/utils/loginLockout";

// Dummy bcrypt hash used when the admin email is not found, to keep response
// time constant and prevent email enumeration via timing.
const DUMMY_BCRYPT_HASH =
  "$2a$12$CwTycUXWue0Thq9StjUM0uJ8nC9wQhQLBXa8l7w2eJg6P9aQ2bR1y";

interface AuthMeta {
  userAgent: string;
  ipAddress: string;
}

interface AdminAuthResult {
  admin: AdminDocument;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

/**
 * Authenticates an admin by email + password.
 *
 * Security measures (same as student login):
 *  1. Dummy bcrypt compare when email not found (timing attack prevention).
 *  2. Account lockout after MAX_LOGIN_ATTEMPTS failed attempts.
 *  3. On success: reset counter, update lastLoginAt, issue token pair.
 */
export async function loginAdmin(
  input: AdminLoginInput,
  meta: AuthMeta
): Promise<AdminAuthResult> {
  const admin = await Admin.findOne({ email: input.email.toLowerCase() }).select(
    "+passwordHash"
  );

  if (!admin) {
    // Run dummy compare to keep response time identical whether email exists or not.
    await bcrypt.compare(input.password, DUMMY_BCRYPT_HASH);
    throw ApiError.unauthorized(
      "الإيميل أو كلمة السر غير صحيحة",
      "INVALID_CREDENTIALS"
    );
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    throw ApiError.tooManyRequests(
      "الحساب متوقف مؤقتاً بسبب محاولات دخول كتيرة",
      "ACCOUNT_LOCKED"
    );
  }

  const attempt = await takeLoginAttempt(Admin, admin._id);
  if (!attempt) {
    throw ApiError.tooManyRequests(
      "الحساب متوقف مؤقتاً بسبب محاولات دخول كتيرة",
      "ACCOUNT_LOCKED"
    );
  }

  const passwordMatch = await bcrypt.compare(input.password, admin.passwordHash);
  if (!passwordMatch) {
    if (attempt.last) {
      await lockAccount(Admin, admin._id);
      logger.warn(`Admin account locked due to failed attempts`, {
        adminId: admin._id.toString(),
        ip: meta.ipAddress,
      });
    }
    throw ApiError.unauthorized(
      "الإيميل أو كلمة السر غير صحيحة",
      "INVALID_CREDENTIALS"
    );
  }

  admin.lastLoginAt = new Date();
  await clearLoginAttempts(Admin, admin._id, { lastLoginAt: admin.lastLoginAt });

  const tokens = await issueAdminTokensAndSession(admin._id, meta);

  return { admin, ...tokens };
}

/**
 * Internal helper: creates an admin session and returns a signed token pair.
 * Separated from loginAdmin() so it can also be called after MFA in the future.
 */
async function issueAdminTokensAndSession(
  adminId: Types.ObjectId,
  meta: AuthMeta
) {
  const refreshToken = signRefreshToken({
    sub: adminId.toString(),
    role: ROLES.ADMIN,
  });

  const session = await createSession({
    userId: adminId,
    role: ROLES.ADMIN,
    refreshToken,
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  const accessToken = signAccessToken({
    sub: adminId.toString(),
    role: ROLES.ADMIN,
    sessionId: session._id.toString(),
  });

  return {
    accessToken,
    refreshToken,
    sessionId: session._id.toString(),
  };
}

/**
 * Rotates an admin session: verifies the refresh token, detects token reuse,
 * and issues a new token pair.
 * Identical logic to refreshStudentSession (including the parallel-refresh
 * grace: refreshToken null) but uses the admin role.
 */
export async function refreshAdminSession(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("الجلسة غير صالحة، سجّل الدخول تاني.", "INVALID_REFRESH_TOKEN");
  }

  if (payload.role !== ROLES.ADMIN) {
    throw ApiError.unauthorized("الجلسة غير صالحة، سجّل الدخول تاني.", "WRONG_TOKEN_TYPE");
  }

  let session = await findSessionByRefreshToken(refreshToken);
  let racing = false;
  if (!session) {
    session = await findSessionJustRotatedFrom(refreshToken);
    racing = !!session;
  }
  if (!session) {
    const stolenSession = await findSessionByAnyRefreshHash(refreshToken);
    if (stolenSession) {
      logger.warn("Admin refresh-token reuse detected — revoking all sessions", {
        adminId: payload.sub,
        sessionId: stolenSession._id.toString(),
      });
      await revokeAllUserSessions(
        stolenSession.userId,
        ROLES.ADMIN,
        "REFRESH_TOKEN_REUSE"
      );
    }
    throw ApiError.unauthorized(
      "الجلسة منتهية. سجّل دخول من جديد",
      "SESSION_NOT_FOUND"
    );
  }

  const admin = await Admin.findById(payload.sub);
  if (!admin) {
    await revokeSession(session._id, "ADMIN_NOT_FOUND");
    throw ApiError.unauthorized("الحساب غير متاح", "ADMIN_NOT_FOUND");
  }

  const newAccessToken = signAccessToken({
    sub: admin._id.toString(),
    role: ROLES.ADMIN,
    sessionId: session._id.toString(),
  });

  if (!racing) {
    const newRefreshToken = signRefreshToken({
      sub: admin._id.toString(),
      role: ROLES.ADMIN,
    });
    if (await rotateSession(session._id, refreshToken, newRefreshToken)) {
      return { accessToken: newAccessToken, refreshToken: newRefreshToken, admin };
    }
    // A parallel refresh rotated it first — or the session was just revoked.
    if (!(await findSessionJustRotatedFrom(refreshToken))) {
      throw ApiError.unauthorized(
        "الجلسة منتهية. سجّل دخول من جديد",
        "SESSION_NOT_FOUND"
      );
    }
  }

  return { accessToken: newAccessToken, refreshToken: null, admin };
}

/**
 * Changes the signed-in admin's password after verifying the current one, then
 * signs out every OTHER device. The session that made the change stays active.
 */
export async function changeAdminPassword(
  adminId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId: string | undefined
) {
  const admin = await Admin.findById(adminId).select("+passwordHash");
  if (!admin) throw ApiError.notFound("الأدمن غير موجود", "ADMIN_NOT_FOUND");

  const matches = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!matches) {
    throw ApiError.badRequest(
      "كلمة السر الحالية غير صحيحة",
      "WRONG_CURRENT_PASSWORD"
    );
  }

  admin.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  admin.failedLoginAttempts = 0;
  admin.lockedUntil = null;
  await admin.save();

  await revokeOtherUserSessions(
    admin._id,
    ROLES.ADMIN,
    currentSessionId,
    "PASSWORD_CHANGED"
  );
}

/** Revokes the admin's current session (called on logout). */
export async function logoutAdmin(sessionId: string | undefined) {
  if (!sessionId) return;
  await revokeSession(sessionId);
}
