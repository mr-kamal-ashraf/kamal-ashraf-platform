import { randomUUID } from "crypto";
import jwt, {
  type SignOptions,
  type VerifyOptions,
  type Algorithm,
} from "jsonwebtoken";
import { env } from "../../config/env";
import type { Role } from "../../config/constants";

/**
 * The payload stored inside every JWT.
 * - sub: the user's MongoDB ObjectId string (student or admin).
 * - role: "student" or "admin" — used by auth middleware to enforce route access.
 * - sessionId: the DB session record ID; allows instant server-side revocation.
 */
export interface JwtPayload {
  sub: string;
  role: Role;
  sessionId?: string;
}

// We pin to HS256 (HMAC-SHA256) everywhere to prevent the "alg:none" attack.
const JWT_ALGORITHM: Algorithm = "HS256";
// Explicitly whitelist algorithms on verify so attackers can't change alg to "none".
const VERIFY_OPTIONS: VerifyOptions = { algorithms: [JWT_ALGORITHM] };

/**
 * Signs a short-lived access token (default: 15 minutes).
 * Signed with JWT_ACCESS_SECRET — a different secret from the refresh token.
 */
export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

/**
 * Signs a long-lived refresh token (default: 7 days).
 * Stored only in an HttpOnly cookie and hashed in the DB — never exposed as plaintext.
 * A random id makes every token unique: without it, two signed for the same
 * user in the same second (two devices logging in together) were identical,
 * and one device's refresh could rotate the other's session.
 */
export function signRefreshToken(payload: JwtPayload): string {
  const options: SignOptions = {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    jwtid: randomUUID(),
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

/**
 * Verifies an access token and returns its payload.
 * Throws jwt.JsonWebTokenError or jwt.TokenExpiredError on failure.
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, VERIFY_OPTIONS) as JwtPayload;
}

/**
 * Verifies a refresh token and returns its payload.
 * Used in /auth/refresh and /admin/auth/refresh to issue new token pairs.
 */
export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, VERIFY_OPTIONS) as JwtPayload;
}
