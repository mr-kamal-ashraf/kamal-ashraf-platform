import { Router } from "express";
import {
  register,
  sendRegistrationCodes,
  verifyRegistrationCodes,
  login,
  logout,
  refresh,
  me,
  changePassword,
  forgotPassword,
  verifyPasswordReset,
  resetPassword,
} from "./auth.controller";
import {
  registerSchema,
  registrationVerificationRequestSchema,
  registrationVerificationCheckSchema,
  loginSchema,
  changePasswordSchema,
  passwordResetRequestSchema,
  passwordResetCheckSchema,
  passwordResetSchema,
} from "./auth.validation";
import { validate } from "../../shared/middlewares/validate.middleware";
import { authenticateStudent } from "../../shared/middlewares/auth.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  authLimiter,
  passwordResetCodeLimiter,
  passwordResetLimiter,
  refreshLimiter,
  registrationCodeLimiter,
} from "../../shared/middlewares/rateLimit.middleware";

const router = Router();

// ── Public routes (no auth required) ────────────────────────────────────────────
// authLimiter caps failed attempts at 5 per 15 min to slow down brute force.
/**
 * POST /auth/register/send-codes
 * Sends distinct six-digit codes to the student and parent WhatsApp numbers.
 * Kept separate from registration so no User document exists before both
 * numbers have proved ownership.
 */
router.post(
  "/register/send-codes",
  registrationCodeLimiter,
  validate(registrationVerificationRequestSchema),
  asyncHandler(sendRegistrationCodes),
);

router.post(
  "/register/verify-codes",
  validate(registrationVerificationCheckSchema),
  asyncHandler(verifyRegistrationCodes),
);

/**
 * POST /auth/register
 * Creates a new student account with email, password, full name, phone, and stage.
 * Returns the created user object (password excluded) and sets a refreshToken cookie.
 * Rate-limited to 5 attempts per 15 minutes to slow down spam registration.
 */
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(register),
);

/**
 * POST /auth/login
 * Authenticates a student using email + password.
 * Returns an accessToken (in response body) and a refreshToken (in httpOnly cookie).
 * Rate-limited to 5 failed attempts per 15 minutes to prevent brute-force.
 */
router.post("/login", authLimiter, validate(loginSchema), asyncHandler(login));

/**
 * POST /auth/refresh
 * Issues a new accessToken using the refreshToken stored in the cookie.
 * Called automatically by the client when the access token expires (30 req / 15 min limit).
 */
router.post("/refresh", refreshLimiter, asyncHandler(refresh));

/**
 * Forgot password — a three-step flow for a student who can't log in:
 *   POST /auth/password/forgot  { studentPhone }               → code on WhatsApp
 *   POST /auth/password/verify  { studentPhone, code }         → code is right
 *   POST /auth/password/reset   { studentPhone, code, newPassword }
 * Resetting revokes every session of the account.
 */
router.post(
  "/password/forgot",
  passwordResetCodeLimiter,
  validate(passwordResetRequestSchema),
  asyncHandler(forgotPassword),
);
router.post(
  "/password/verify",
  passwordResetLimiter,
  validate(passwordResetCheckSchema),
  asyncHandler(verifyPasswordReset),
);
router.post(
  "/password/reset",
  passwordResetLimiter,
  validate(passwordResetSchema),
  asyncHandler(resetPassword),
);

/**
 * POST /auth/logout
 * Logs out the student and clears the refreshToken cookie.
 * Works even if the accessToken is expired (required=false) so the client can always clear cookies.
 */
router.post("/logout", authenticateStudent(false), asyncHandler(logout));

// ── Authenticated routes ──────────────────────────────────────────────────

/**
 * GET /auth/me
 * Returns the current student's profile data (name, email, stage, subscription status).
 * Requires a valid student JWT from the Authorization header.
 */
router.get("/me", authenticateStudent(), asyncHandler(me));

/**
 * PATCH /auth/change-password
 * Allows a student to change their password by providing the current password + new password.
 * Requires authentication. The new password must meet complexity requirements.
 */
router.patch(
  "/change-password",
  authenticateStudent(),
  validate(changePasswordSchema),
  asyncHandler(changePassword),
);

export default router;
