import { Router } from "express";
import { login, logout, refresh, me, changePassword } from "./admin-auth.controller";
import {
  adminChangePasswordSchema,
  adminLoginSchema,
} from "./admin-auth.validation";
import { validate } from "../../shared/middlewares/validate.middleware";
import { authenticateAdmin } from "../../shared/middlewares/auth.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  adminAuthLimiter,
  adminPasswordChangeLimiter,
  refreshLimiter,
} from "../../shared/middlewares/rateLimit.middleware";

const router = Router();

// ── Public routes ────────────────────────────────────────────────────────────────
// adminAuthLimiter is stricter than the general limiter (5 req/15 min)
// to protect the admin login endpoint from brute-force attacks.
/**
 * POST /admin/auth/login
 * Authenticates an admin using email + password.
 * Returns an accessToken (in response body) and a refreshToken (in httpOnly cookie).
 * Protected by rate limiter (5 attempts / 15 min) to prevent brute-force attacks.
 */
router.post(
  "/login",
  adminAuthLimiter,
  validate(adminLoginSchema),
  asyncHandler(login)
);

/**
 * POST /admin/auth/refresh
 * Issues a new accessToken using the refreshToken stored in the cookie.
 * Returns the new accessToken in the response body.
 */
router.post("/refresh", refreshLimiter, asyncHandler(refresh));

/**
 * POST /admin/auth/logout
 * Logs out the admin and clears the refreshToken cookie.
 * Works even if the accessToken is expired (required=false) so the client can always clear cookies.
 */
router.post("/logout", authenticateAdmin(false), asyncHandler(logout));

// ── Authenticated routes ───────────────────────────────────────────────────────

/**
 * GET /admin/auth/me
 * Returns the current admin's profile data.
 * Requires a valid admin JWT from the cookie.
 */
router.get("/me", authenticateAdmin(), asyncHandler(me));

/**
 * PATCH /admin/auth/change-password
 * Changes the current admin's password (needs the current one) and signs out
 * every other device. Rate-limited (own counter, separate from login) so the
 * current password can't be brute-forced through this endpoint.
 */
router.patch(
  "/change-password",
  adminPasswordChangeLimiter,
  authenticateAdmin(),
  validate(adminChangePasswordSchema),
  asyncHandler(changePassword)
);

export default router;
