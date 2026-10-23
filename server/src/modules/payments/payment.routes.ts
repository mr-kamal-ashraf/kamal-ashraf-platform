import { Router } from "express";
import {
  checkout,
  paymobWebhook,
  listMine,
  listMethods,
  verify,
} from "./payment.controller";
import { authenticateStudent } from "../../shared/middlewares/auth.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { validate } from "../../shared/middlewares/validate.middleware";
import {
  checkoutLimiter,
  paymentVerifyLimiter,
} from "../../shared/middlewares/rateLimit.middleware";
import { checkoutSchema, verifyPaymentSchema } from "./payment.validation";

const router = Router();

// ── Paymob server-to-server callback (PUBLIC — no cookie auth) ─────────────────
// Security is the HMAC signature verified inside the handler, not a session.
router.post("/paymob/webhook", asyncHandler(paymobWebhook));

// ── Student routes ─────────────────────────────────────────────────────────────
router.use(authenticateStudent());

/** GET /payments/methods — the payment methods this platform offers. */
router.get("/methods", asyncHandler(listMethods));
/** POST /payments/courses/:courseId/checkout { method?, walletPhone? } — start buying a course. */
router.post(
  "/courses/:courseId/checkout",
  checkoutLimiter,
  validate(checkoutSchema),
  asyncHandler(checkout),
);
/** POST /payments/verify — back from Paymob: settle that order now if it was paid. */
router.post(
  "/verify",
  paymentVerifyLimiter,
  validate(verifyPaymentSchema),
  asyncHandler(verify),
);
/** GET /payments/mine — the student's own payment history. */
router.get("/mine", asyncHandler(listMine));

export default router;
