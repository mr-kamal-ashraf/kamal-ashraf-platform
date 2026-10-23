import type { CookieOptions, Response } from "express";
import ms from "./ms";
import { env } from "../../config/env";
import { COOKIE_NAMES } from "../../config/constants";

/**
 * Builds the base options for every auth cookie.
 *
 * Security decisions:
 *  - httpOnly: true  — JavaScript cannot read these cookies (XSS protection).
 *  - secure: true in prod  — only sent over HTTPS.
 *  - sameSite: "none" when secure, "lax" otherwise  — "none" is REQUIRED for
 *    the common production deploy where the frontend and backend live on
 *    different domains (e.g. Vercel + Railway). Under `SameSite=Strict` or
 *    even `Lax`, browsers refuse to store or send the cookie on cross-site
 *    requests, so a successful register/login silently returns no cookie
 *    and every follow-up request 401s with "Authentication required".
 *    CSRF protection is still enforced by the CORS layer, which limits the
 *    allowed Origin to CLIENT_URL — an attacker's site cannot make a
 *    credentialed request to this backend regardless of SameSite.
 *  - domain: undefined for localhost so the browser doesn't reject the cookie.
 */
function baseCookieOptions(maxAgeMs: number): CookieOptions {
  const secure = env.NODE_ENV === "production" ? true : env.COOKIE_SECURE;
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    domain: env.COOKIE_DOMAIN === "localhost" ? undefined : env.COOKIE_DOMAIN,
    path: "/",
    maxAge: maxAgeMs,  // milliseconds; browser removes the cookie after this time
  };
}

/**
 * Set access + refresh token cookies for a student after login / register.
 * A null refresh token (a refresh that raced another one) leaves the
 * browser's refresh cookie as it is.
 */
export function setStudentAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string | null
) {
  res.cookie(
    COOKIE_NAMES.ACCESS_TOKEN,
    accessToken,
    baseCookieOptions(ms(env.JWT_ACCESS_EXPIRES_IN))
  );
  if (refreshToken === null) return;
  res.cookie(
    COOKIE_NAMES.REFRESH_TOKEN,
    refreshToken,
    baseCookieOptions(ms(env.JWT_REFRESH_EXPIRES_IN))
  );
}

/** Remove student auth cookies on logout (sets maxAge=0, browser deletes them). */
export function clearStudentAuthCookies(res: Response) {
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, baseCookieOptions(0));
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, baseCookieOptions(0));
}

/** Set access + refresh token cookies for an admin after login (null refresh: as above). */
export function setAdminAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string | null
) {
  res.cookie(
    COOKIE_NAMES.ADMIN_ACCESS_TOKEN,
    accessToken,
    baseCookieOptions(ms(env.JWT_ACCESS_EXPIRES_IN))
  );
  if (refreshToken === null) return;
  res.cookie(
    COOKIE_NAMES.ADMIN_REFRESH_TOKEN,
    refreshToken,
    baseCookieOptions(ms(env.JWT_REFRESH_EXPIRES_IN))
  );
}

/** Remove admin auth cookies on logout. */
export function clearAdminAuthCookies(res: Response) {
  res.clearCookie(COOKIE_NAMES.ADMIN_ACCESS_TOKEN, baseCookieOptions(0));
  res.clearCookie(COOKIE_NAMES.ADMIN_REFRESH_TOKEN, baseCookieOptions(0));
}
