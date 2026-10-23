import { Router } from "express";
import {
  listRefundAlertsHandler,
  resolveRefundAlertHandler,
} from "./payment.admin.controller";
import { asyncHandler } from "../../shared/utils/asyncHandler";

/**
 * Admin router for payments that need the teacher.
 * Mounted at /admin/payments; the parent admin router already enforces the
 * admin JWT, so no extra auth middleware is needed here.
 */
const router = Router();

/** GET /admin/payments/refund-alerts — payments to refund, newest first. */
router.get("/refund-alerts", asyncHandler(listRefundAlertsHandler));

/** POST /admin/payments/refund-alerts/:id/resolve — refunded (or course opened). */
router.post(
  "/refund-alerts/:id/resolve",
  asyncHandler(resolveRefundAlertHandler),
);

export default router;
