import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env";
import { COOKIE_NAMES, ROLES } from "../../config/constants";
import { verifyAccessToken } from "../utils/jwt";

/**
 * Rate limiters applied at different levels:
 *
 *  generalLimiter  — applied globally (default: 100 req/15 min per IP), EXCEPT
 *                    for requests that carry a valid admin session: once the
 *                    teacher is logged in, the admin panel is not rate limited
 *                    (the admin login keeps its own limiter below).
 *  authLimiter     — student login/register only (5 req/15 min, success ignored).
 *  adminAuthLimiter — admin login only (5 req/15 min, success ignored).
 *  refreshLimiter  — token refresh endpoints (30 req/15 min).
 *  progressLimiter — progress saves, one per exit from a lesson (60 req/min).
 *
 * standardHeaders: true  — adds RateLimit-* response headers (RFC 6585).
 * legacyHeaders: false   — omits the old X-RateLimit-* headers.
 */

/**
 * True when the request carries a valid, unexpired ADMIN access token (cookie,
 * or the same Bearer fallback the auth middleware accepts).
 *
 * Only the JWT signature and role are checked here — no DB lookup — because
 * this runs on every request and only decides whether to COUNT it. A forged,
 * expired or student token fails verification and is counted like anyone
 * else's; every admin route still goes through authenticateAdmin() for the
 * real session check.
 */
function hasValidAdminToken(req: Request): boolean {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice("Bearer ".length)
    : undefined;
  const token = req.cookies?.[COOKIE_NAMES.ADMIN_ACCESS_TOKEN] || bearer;
  if (!token) return false;
  try {
    return verifyAccessToken(token).role === ROLES.ADMIN;
  } catch {
    return false;
  }
}

/**
 * The public site-settings read (GET <prefix>/settings). The website's server
 * fetches it on every render from ONE address (the Next.js host), so counting
 * it would let ordinary traffic exhaust the limit and the whole site would
 * fall back to the default colours and font. It's read-only and cached for
 * 15s in memory, so it's safe to leave out.
 */
function isPublicSettingsRead(req: Request): boolean {
  return (
    req.method === "GET" &&
    req.originalUrl.split("?")[0] === `${env.API_PREFIX}/settings`
  );
}

/**
 * Applied to every route via app.use() in app.ts. A logged-in admin is skipped:
 * clicking through the admin panel fires many API calls per page and must never
 * lock the teacher out. The public settings read is skipped too (see above).
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isPublicSettingsRead(req) || hasValidAdminToken(req),
  message: {
    success: false,
    message: "طلبات كتير في وقت قصير — استنى شوية وحاول تاني.",
    code: "RATE_LIMIT_EXCEEDED",
  },
});

/**
 * Student login/register limiter.
 * skipSuccessfulRequests: true — only counts failed attempts against the limit,
 * so legitimate users who log in successfully are not penalised.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "حاولت تسجّل دخول مرات كتير — استنى ١٥ دقيقة وحاول تاني.",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
  },
});

/** Code delivery is costly and can be abused to spam WhatsApp recipients. */
export const registrationCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "طلبت أكواد كتير في وقت قصير — استنى شوية وحاول تاني.",
    code: "VERIFICATION_SEND_RATE_LIMIT_EXCEEDED",
  },
});

/** Forgot-password code delivery — its own counter, same spam guard as above. */
export const passwordResetCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "طلبت أكواد كتير في وقت قصير — استنى شوية وحاول تاني.",
    code: "PASSWORD_RESET_SEND_RATE_LIMIT_EXCEEDED",
  },
});

/**
 * Forgot-password code checks. Only failures count; on top of this each code
 * dies after a few wrong tries (auth.service), so guessing is hopeless.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "محاولات كتير غلط — استنى ١٥ دقيقة وحاول تاني.",
    code: "PASSWORD_RESET_RATE_LIMIT_EXCEEDED",
  },
});

/**
 * Course-code redemption. Only failures count, so a student opening several
 * courses with valid codes is never blocked; a guesser is stopped quickly.
 */
export const codeRedeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "جرّبت أكواد غلط كتير — استنى ١٥ دقيقة وحاول تاني.",
    code: "CODE_REDEEM_RATE_LIMIT_EXCEEDED",
  },
});

/** "Back from Paymob" checks — each one asks Paymob, so keep them reasonable. */
export const paymentVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "طلبات كتير في وقت قصير — استنى شوية وحاول تاني.",
    code: "PAYMENT_VERIFY_RATE_LIMIT_EXCEEDED",
  },
});

/**
 * Starting a checkout — each one opens an order with Paymob, so a script
 * can't flood it. Generous for a real student (the checkout page opens one
 * per visit, plus switching methods).
 */
export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "حاولت تبدأ الدفع مرات كتير — استنى شوية وحاول تاني.",
    code: "CHECKOUT_RATE_LIMIT_EXCEEDED",
  },
});

/** Admin login limiter — same rules as authLimiter but a separate counter. */
export const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "محاولات دخول كتير — استنى ١٥ دقيقة وحاول تاني.",
    code: "ADMIN_AUTH_RATE_LIMIT_EXCEEDED",
  },
});

/**
 * Admin change-password limiter — its own counter, so wrong "current
 * password" attempts can't lock the teacher out of logging in (and the
 * message talks about changing the password, not logging in).
 */
export const adminPasswordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "جرّبت تغيّر كلمة السر مرات كتير — استنى ١٥ دقيقة وحاول تاني.",
    code: "ADMIN_PASSWORD_CHANGE_RATE_LIMIT_EXCEEDED",
  },
});

// Refresh tokens are long-lived and stolen ones can be brute-tested or
// abused, so rate-limit /auth/refresh independently of /auth/login.
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "طلبات كتير في وقت قصير — استنى شوية وحاول تاني.",
    code: "REFRESH_RATE_LIMIT_EXCEEDED",
  },
});

// /progress/:id is hit every few seconds while a student watches a video,
// so the global limiter is too tight. Keep it generous but bounded.
export const progressLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "في ضغط على الخدمة دلوقتي — استنى لحظات وحاول تاني.",
    code: "PROGRESS_RATE_LIMIT_EXCEEDED",
  },
});
