import crypto from "crypto";
import { Types } from "mongoose";
import { Session, type SessionDocument } from "./session.model";
import { env } from "../../config/env";
import ms from "../../shared/utils/ms";
import type { Role } from "../../config/constants";
import { logger } from "../../shared/utils/logger";

interface CreateSessionInput {
  userId: string | Types.ObjectId;
  role: Role;
  refreshToken: string;
  userAgent: string;
  ipAddress: string;
}

/**
 * Hashes a refresh token with SHA-256 before storing it in the DB.
 * We never store raw tokens — only hashes — so a DB leak cannot be used
 * to impersonate users.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Parses the User-Agent string and produces a short human-readable label
 * like "Chrome on Windows NT 10.0" for display in the active sessions list.
 */
function buildDeviceLabel(userAgent: string): string {
  if (!userAgent) return "Unknown device";

  const browserMatch =
    /(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)\/?([\d.]*)/i.exec(userAgent);
  const osMatch =
    /(Windows NT [\d.]+|Mac OS X [\d_]+|Android [\d.]+|iOS|iPhone|iPad|Linux)/i.exec(
      userAgent
    );

  const browser = browserMatch ? browserMatch[1] : "Browser";
  const os = osMatch ? osMatch[0].replace(/_/g, ".") : "Unknown OS";
  return `${browser} on ${os}`;
}

/**
 * Creates a new session record in the DB when a user logs in.
 * Steps:
 *  1. Convert userId to ObjectId if it arrived as a string.
 *  2. Calculate expiry from JWT_REFRESH_EXPIRES_IN env var.
 *  3. Enforce the device limit (revoke oldest sessions if over limit).
 *  4. Save the new session with the hashed refresh token.
 */
export async function createSession(
  input: CreateSessionInput
): Promise<SessionDocument> {
  const { userId, role, refreshToken, userAgent, ipAddress } = input;

  const userIdObj =
    typeof userId === "string" ? new Types.ObjectId(userId) : userId;

  const expiresAt = new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN));

  await enforceDeviceLimit(userIdObj, role);

  const session = await Session.create({
    userId: userIdObj,
    role,
    refreshTokenHash: hashRefreshToken(refreshToken),
    userAgent,
    ipAddress,
    deviceLabel: buildDeviceLabel(userAgent),
    expiresAt,
    lastActiveAt: new Date(),
  });

  return session;
}

/**
 * Ensures a user doesn't exceed MAX_DEVICES_PER_USER concurrent sessions.
 * If they are at the limit, the oldest (least recently active) sessions are
 * revoked to make room for the new one.
 */
export async function enforceDeviceLimit(
  userId: Types.ObjectId,
  role: Role
): Promise<void> {
  const activeSessions = await Session.find({
    userId,
    role,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastActiveAt: 1 })   // oldest sessions first
    .lean();

  // overflow = number of existing sessions that must be removed to stay within limit.
  const overflow = activeSessions.length - (env.MAX_DEVICES_PER_USER - 1);
  if (overflow > 0) {
    const toRevoke = activeSessions.slice(0, overflow).map((s) => s._id);
    await Session.updateMany(
      { _id: { $in: toRevoke } },
      { $set: { revokedAt: new Date() } }
    );
    logger.info(`Device limit enforced — revoked ${toRevoke.length} session(s)`, {
      userId: userId.toString(),
      role,
    });
  }
}

/**
 * Finds an active (non-revoked, non-expired) session by matching the refresh token hash.
 * Returns null if no matching session is found (token is invalid, expired, or revoked).
 */
export async function findSessionByRefreshToken(
  refreshToken: string
): Promise<SessionDocument | null> {
  const hash = hashRefreshToken(refreshToken);
  return Session.findOne({
    refreshTokenHash: hash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
}

/**
 * Look for any session — active or revoked — whose CURRENT or PREVIOUS
 * refresh token hash matches. Used to detect refresh-token reuse: if a
 * caller presents a token that we've already rotated away from, that
 * token has likely been stolen.
 */
export async function findSessionByAnyRefreshHash(
  refreshToken: string
): Promise<SessionDocument | null> {
  const hash = hashRefreshToken(refreshToken);
  return Session.findOne({
    $or: [
      { refreshTokenHash: hash },
      { previousRefreshTokenHash: hash },
    ],
  });
}

/**
 * How long the refresh token a rotation just replaced is still honoured. Two
 * tabs of one browser can refresh at the same moment: the slower request
 * carries the old token (its cookie was read before the faster answer
 * landed). That's a race, not a stolen token — it gets a new access token,
 * and the browser keeps the refresh cookie the faster request set. Outside
 * this window the old token counts as reuse, as before.
 */
const ROTATION_GRACE_MS = 30 * 1000;

/**
 * Rotates a session to a new refresh token.
 * The old token hash is saved as previousRefreshTokenHash so that if the
 * same old token is presented again (reuse attack), we can detect it.
 * Only rotates away from the token presented (one conditional write): false
 * when a parallel request rotated it first, or the session was revoked.
 */
export async function rotateSession(
  oldSessionId: Types.ObjectId,
  oldRefreshToken: string,
  newRefreshToken: string
): Promise<boolean> {
  const now = new Date();
  const result = await Session.updateOne(
    {
      _id: oldSessionId,
      refreshTokenHash: hashRefreshToken(oldRefreshToken),
      revokedAt: null,
    },
    {
      $set: {
        refreshTokenHash: hashRefreshToken(newRefreshToken),
        previousRefreshTokenHash: hashRefreshToken(oldRefreshToken),
        lastActiveAt: now,
        rotatedAt: now,
      },
    }
  );
  return result.modifiedCount === 1;
}

/**
 * The live session that rotated away from this refresh token moments ago
 * (see ROTATION_GRACE_MS), or null.
 */
export async function findSessionJustRotatedFrom(
  refreshToken: string
): Promise<SessionDocument | null> {
  return Session.findOne({
    previousRefreshTokenHash: hashRefreshToken(refreshToken),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
    rotatedAt: { $gt: new Date(Date.now() - ROTATION_GRACE_MS) },
  });
}

/** Revokes a single session (e.g. on logout or admin revocation). */
export async function revokeSession(
  sessionId: string | Types.ObjectId,
  reason: string | null = null
) {
  await Session.updateOne(
    { _id: sessionId },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
}

/** Revokes ALL active sessions for a user (e.g. on password change or account suspension). */
export async function revokeAllUserSessions(
  userId: string | Types.ObjectId,
  role: Role,
  reason: string | null = null
) {
  await Session.updateMany(
    { userId, role, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
}

/**
 * Revokes every active session for a user EXCEPT one (e.g. after a password
 * change: sign out all other devices but keep the one that made the change).
 */
export async function revokeOtherUserSessions(
  userId: string | Types.ObjectId,
  role: Role,
  keepSessionId: string | Types.ObjectId | undefined,
  reason: string | null = null
) {
  await Session.updateMany(
    {
      userId,
      role,
      revokedAt: null,
      ...(keepSessionId ? { _id: { $ne: keepSessionId } } : {}),
    },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
}

/** Returns all currently active (non-revoked, non-expired) sessions for a user. */
export async function listActiveSessions(
  userId: string | Types.ObjectId,
  role: Role
) {
  return Session.find({
    userId,
    role,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastActiveAt: -1 })
    .lean();
}
