import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken, verifyRefreshToken } from "../utils/jwt";
import { COOKIE_NAMES, ROLES, type Role } from "../../config/constants";
import { Session } from "../../modules/sessions/session.model";
import {
  findSessionByRefreshToken,
  findSessionJustRotatedFrom,
} from "../../modules/sessions/session.service";
import { User } from "../../modules/users/user.model";

interface AuthOptions {
  required?: boolean;       // If true (default), reject unauthenticated requests.
  cookieName?: string;      // Name of the cookie to read the access token from.
  expectedRole?: Role;      // If set, reject tokens with a different role.
}

/**
 * Core authentication middleware factory.
 * Reads the access token from a cookie (primary) or Authorization header (fallback),
 * verifies it, checks the session is still active in the DB, and attaches
 * req.user = { id, role, sessionId } for downstream handlers.
 *
 * If required=false the middleware skips silently when no token is present
 * (useful for routes that work for both guests and logged-in users).
 */
export function authenticate(options: AuthOptions = {}) {
  const { required = true, cookieName = COOKIE_NAMES.ACCESS_TOKEN, expectedRole } =
    options;

  return async (req: Request, _res: Response, next: NextFunction) => {
    // Accept the token from a cookie OR an Authorization: Bearer header.
    const cookieToken = req.cookies?.[cookieName];
    const headerToken = extractBearerToken(req.headers.authorization);
    const token = cookieToken || headerToken;

    if (!token) {
      if (!required) return next();
      return next(
        ApiError.unauthorized("لازم تسجّل دخول الأول.", "NOT_AUTHENTICATED")
      );
    }

    try {
      const payload = verifyAccessToken(token);
      if (expectedRole && payload.role !== expectedRole) {
        return next(ApiError.forbidden("الصفحة دي مش متاحة لحسابك.", "WRONG_ROLE"));
      }

      // Verify the session is still active in the DB.
      // This is the key mechanism for instant server-side revocation:
      // when an admin revokes a session, the DB record is marked revokedAt,
      // so the next request by that token is rejected even if the JWT is still valid.
      if (payload.sessionId && Types.ObjectId.isValid(payload.sessionId)) {
        const session = await Session.findOne({
          _id: payload.sessionId,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        }).select("_id userId role").lean();

        if (!session) {
          if (!required) return next();
          return next(
            ApiError.unauthorized("الجلسة انتهت، سجّل الدخول تاني.", "SESSION_REVOKED")
          );
        }
      } else if (required) {
        return next(
          ApiError.unauthorized("الجلسة غير صالحة، سجّل الدخول تاني.", "INVALID_SESSION")
        );
      }

      // For students only: check the isSuspended flag on every request.
      // Admins cannot be suspended, so we skip this check for the admin role.
      if (payload.role === ROLES.STUDENT) {
        const user = await User.findById(payload.sub)
          .select("isSuspended")
          .lean();
        if (!user) {
          if (!required) return next();
          return next(
            ApiError.unauthorized("المستخدم غير موجود", "USER_NOT_FOUND")
          );
        }
        if (user.isSuspended) {
          return next(
            ApiError.forbidden(
              "حسابك معلّق. تواصل مع الأستاذ",
              "ACCOUNT_SUSPENDED"
            )
          );
        }
      }

      req.user = {
        id: payload.sub,
        role: payload.role,
        sessionId: payload.sessionId,
      };
      next();
    } catch (err) {
      if (!required) return next();
      next(err);
    }
  };
}

/** Convenience wrapper — authenticates students; uses the student cookie. */
export function authenticateStudent(required = true) {
  return authenticate({
    required,
    cookieName: COOKIE_NAMES.ACCESS_TOKEN,
    expectedRole: ROLES.STUDENT,
  });
}

/** Convenience wrapper — authenticates admins; uses the admin cookie. */
export function authenticateAdmin(required = true) {
  return authenticate({
    required,
    cookieName: COOKIE_NAMES.ADMIN_ACCESS_TOKEN,
    expectedRole: ROLES.ADMIN,
  });
}

/**
 * For the progress save a student's browser sends as they leave a lesson.
 * Nothing is sent while the video plays, so after a lesson longer than the
 * access token's 15 minutes that cookie is gone by the time they leave — and
 * a page that's closing can't stop to refresh it. The session's refresh
 * cookie vouches for the student instead, checked against the live session
 * the way /auth/refresh checks it, but read-only: nothing is rotated and no
 * cookie is set.
 */
export function authenticateStudentLeavingLesson() {
  const viaAccessToken = authenticateStudent();
  return (req: Request, res: Response, next: NextFunction) => {
    void viaAccessToken(req, res, (err?: unknown) => {
      if (!err) return next();
      if (!isNotSignedIn(err)) return next(err);
      studentFromRefreshCookie(req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN])
        .then((user) => {
          if (!user) return next(err);
          req.user = user;
          next();
        })
        .catch(next);
    });
  };
}

/** No usable access token — a missing, expired or bad one (not a suspended account). */
function isNotSignedIn(err: unknown): boolean {
  return (
    err instanceof jwt.JsonWebTokenError || // includes TokenExpiredError
    (err instanceof ApiError && err.statusCode === 401)
  );
}

async function studentFromRefreshCookie(token: unknown) {
  if (typeof token !== "string" || !token) return null;
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    return null;
  }
  if (payload.role !== ROLES.STUDENT) return null;

  const session =
    (await findSessionByRefreshToken(token)) ??
    (await findSessionJustRotatedFrom(token)); // another tab refreshed a moment ago
  if (!session || String(session.userId) !== payload.sub) return null;

  const user = await User.findById(payload.sub).select("isSuspended").lean();
  if (!user || user.isSuspended) return null;

  return { id: payload.sub, role: ROLES.STUDENT, sessionId: String(session._id) };
}

/**
 * Extracts a Bearer token from an Authorization header.
 * Returns null if the header is missing or doesn't follow the "Bearer <token>" format.
 */
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}
