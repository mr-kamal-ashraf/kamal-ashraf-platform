import { z } from "zod";
import { PAYMENT_METHOD } from "../../config/constants";

/**
 * POST /payments/courses/:courseId/checkout body. Both fields are optional so
 * an empty body keeps the original card checkout working.
 */
export const checkoutSchema = z.object({
  method: z
    .enum(Object.values(PAYMENT_METHOD) as [string, ...string[]])
    .optional(),
  /** The wallet number to charge (Vodafone Cash etc.); defaults to the student's phone. */
  walletPhone: z
    .string()
    .trim()
    .regex(/^01[0-25]\d{8}$/, "رقم المحفظة لازم يكون 11 رقم ويبدأ بـ 01")
    .optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * POST /payments/verify — the student is back from Paymob. Either id works:
 * ours (merchant_order_id) or Paymob's (order), both in the return URL.
 */
export const verifyPaymentSchema = z
  .object({
    merchantOrderId: z.string().trim().min(1).max(80).optional(),
    paymobOrderId: z.string().trim().regex(/^\d{1,20}$/).optional(),
  })
  .refine((v) => v.merchantOrderId || v.paymobOrderId, {
    message: "رقم الطلب مطلوب",
  });

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
