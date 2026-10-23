import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { recordAuditLog } from "../audit-logs/audit-log.service";
import { AUDIT_ACTIONS } from "../audit-logs/audit-log.model";
import {
  countRefundAlerts,
  listRefundAlerts,
  resolveRefundAlert,
} from "./payment.service";

/**
 * GET /admin/payments/refund-alerts
 * Paid payments that should go back to the student (paid twice, or paid for
 * a course taken back after the payment started), newest first.
 */
export async function listRefundAlertsHandler(_req: Request, res: Response) {
  const [items, total] = await Promise.all([
    listRefundAlerts(),
    countRefundAlerts(),
  ]);
  return sendSuccess(res, { data: { items, total } });
}

/**
 * POST /admin/payments/refund-alerts/:id/resolve
 * The teacher refunded it in Paymob (or opened the course): off the list.
 */
export async function resolveRefundAlertHandler(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const payment = await resolveRefundAlert(String(req.params.id), req.user.id);

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.RESOLVE_REFUND_ALERT,
    targetUserId: payment.userId,
    targetCourseId: payment.courseId,
    metadata: {
      paymentId: String(payment._id),
      reason: payment.refundReason,
      amount: payment.amount,
      paymobTransactionId: payment.paymobTransactionId,
    },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, { message: "تمام، الدفعة اتشالت من القايمة" });
}
