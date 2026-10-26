import type { Request, Response } from "express";
import { Types } from "mongoose";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as paymentService from "./payment.service";
import { availablePaymentMethods, isEmbeddedCardEnabled } from "./paymob.client";
import { logger } from "../../shared/utils/logger";
import type { PaymentMethod } from "../../config/constants";
import type { CheckoutInput, VerifyPaymentInput } from "./payment.validation";

/**
 * POST /payments/courses/:courseId/checkout { method?, walletPhone? }
 * Starts a Paymob checkout for the logged-in student: the card fields to embed
 * (card, Pixel) or an iframe URL (card, classic), a wallet confirmation page
 * (wallet), or a reference to pay in cash at Aman / Masary (kiosk) — or
 * { free:true } for a free course.
 */
export async function checkout(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const courseId = String(req.params.courseId);
  if (!Types.ObjectId.isValid(courseId)) {
    throw ApiError.badRequest("معرف الكورس غير صالح", "INVALID_COURSE_ID");
  }
  const { method, walletPhone } = req.body as CheckoutInput;

  const result = await paymentService.createCourseCheckout({
    userId: req.user.id,
    courseId,
    method: method as PaymentMethod | undefined,
    walletPhone,
  });

  return sendSuccess(res, {
    message: result.free
      ? "تم فتح الكورس"
      : result.kiosk
        ? "رقم الدفع جاهز"
        : "تم تجهيز صفحة الدفع",
    data: result,
  });
}

/**
 * POST /payments/verify { merchantOrderId? | paymobOrderId? }
 * The student is back from Paymob: ask Paymob about that order now and open
 * the course if it was paid (the safety net for a late / lost webhook).
 */
export async function verify(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const { merchantOrderId, paymobOrderId } = req.body as VerifyPaymentInput;
  const result = await paymentService.verifyPaymentForUser({
    userId: req.user.id,
    merchantOrderId,
    paymobOrderId,
  });
  return sendSuccess(res, { data: result });
}

/** GET /payments/methods — which of card / wallet / kiosk are configured. */
export async function listMethods(_req: Request, res: Response) {
  const methods = availablePaymentMethods();
  // cardEmbedded: card fields open inside the page (the browser starts
  // loading them while checkout is being prepared).
  const cardEmbedded = methods.includes("card") && isEmbeddedCardEnabled();
  return sendSuccess(res, { data: { methods, cardEmbedded } });
}

/**
 * POST /payments/paymob/webhook  (public — called by Paymob's servers)
 * Verifies the HMAC and, on a successful transaction, grants course access.
 * Always answers 200 so Paymob stops retrying, regardless of the internal result.
 */
export async function paymobWebhook(req: Request, res: Response) {
  try {
    const hmac =
      typeof req.query.hmac === "string" ? req.query.hmac : undefined;
    const result = await paymentService.handlePaymobWebhook(
      req.body as Record<string, unknown>,
      hmac,
    );
    return res.status(200).json({ received: true, ...result });
  } catch (err) {
    logger.error("Paymob webhook handler threw", {
      error: err instanceof Error ? err.message : err,
    });
    // Still 200 — we've logged it; a 5xx would make Paymob hammer us with retries.
    return res.status(200).json({ received: true, ok: false });
  }
}

/** GET /payments/mine — the student's own payment history. */
export async function listMine(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const payments = await paymentService.listPaymentsForUser(req.user.id);
  return sendSuccess(res, { data: { payments } });
}
