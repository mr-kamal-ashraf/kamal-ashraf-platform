import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { ApiError } from "../utils/ApiError";
import { env } from "../../config/env";

/**
 * Middleware for endpoints that are called BY n8n, not by end-users.
 *
 * Validates the X-Automation-Secret header against env.AUTOMATION_SECRET using
 * a constant-time comparison (timingSafeEqual) so an attacker cannot use response
 * timing to guess the secret one character at a time.
 *
 * Used to protect the /api/v1/internal/* routes (ai-stats, weekly-behind-digest,
 * notify-parent, student-self-stats, and the support/* tools) — all called
 * server-to-server by n8n.
 *
 * These routes bypass the normal cookie/JWT auth because they run server-to-server.
 * This platform's per-platform secret is the only thing standing between the
 * internet and this data, so treat it like a production credential (long,
 * random, rotated on leak).
 */
export function requireAutomationSecret() {
  const expected = env.AUTOMATION_SECRET;
  const expectedBuf = Buffer.from(expected, "utf8");

  return (req: Request, _res: Response, next: NextFunction) => {
    // Header names are lowercased by Express; check both spellings just in case.
    const raw = req.headers["x-automation-secret"];
    const incoming = Array.isArray(raw) ? raw[0] : raw;

    if (!incoming || typeof incoming !== "string") {
      return next(
        ApiError.unauthorized(
          "Missing X-Automation-Secret header",
          "MISSING_AUTOMATION_SECRET",
        ),
      );
    }

    const incomingBuf = Buffer.from(incoming, "utf8");

    // timingSafeEqual throws if the buffers differ in length, so reject early
    // on any length mismatch and don't leak the expected length through timing.
    if (incomingBuf.length !== expectedBuf.length) {
      return next(
        ApiError.unauthorized(
          "Invalid automation secret",
          "INVALID_AUTOMATION_SECRET",
        ),
      );
    }

    if (!timingSafeEqual(incomingBuf, expectedBuf)) {
      return next(
        ApiError.unauthorized(
          "Invalid automation secret",
          "INVALID_AUTOMATION_SECRET",
        ),
      );
    }

    next();
  };
}
