import type { Types } from "mongoose";
import { Payment, type PaymentDocument } from "./payment.model";
import { Course } from "../courses/course.model";
import { User } from "../users/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { logger } from "../../shared/utils/logger";
import { platformName } from "../../shared/utils/platformName";
import { sendWhatsappText } from "../whatsapp-bridge/whatsapp-bridge.service";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "../../config/constants";
import { availablePaymentMethods } from "./paymob.client";
import { env } from "../../config/env";

/*
 * Cash at an Aman / Masary outlet ("kiosk"): the student gets a reference
 * number, pays it in cash at any outlet, and the HMAC-verified webhook opens
 * the course. The rules that keep a student from losing a reference or paying
 * twice live here:
 *   - one open reference per student per course (a unique index + reuse);
 *   - a reference is handed out again only while it has time left and was
 *     made for the current price — otherwise a fresh one replaces it, and the
 *     student is told not to pay the old one;
 *   - once the course opens by ANY route (another method, a code, the
 *     teacher), open references are withdrawn and the student is told;
 *   - a reference paid anyway is still honoured by the webhook (the course
 *     opens, or the second payment is flagged for refund) — money is never
 *     ignored because of our own deadline.
 */

/** How long a kiosk reference is offered — set to what Paymob gives the account. */
export const kioskTtlMs = () => env.PAYMOB_KIOSK_EXPIRY_HOURS * 60 * 60 * 1000;
/**
 * A reference with less than this left isn't handed out again: the student
 * gets a fresh one instead of a number that runs out on the way to the outlet.
 */
const kioskMinLeftMs = () => Math.min(60 * 60 * 1000, kioskTtlMs() / 4);
/** A kiosk payment this young without its reference is still being prepared. */
const KIOSK_PREPARING_MS = 60 * 1000;

/** What the student needs to pay at the outlet. */
export interface KioskReference {
  /** Our order reference — the checkout page checks the payment by it. */
  merchantOrderId: string;
  reference: string;
  amount: number;
  expiresAt: Date;
}

export function kioskPreparing(): ApiError {
  return ApiError.conflict("بنجهزلك رقم الدفع — ثواني وحاول تاني.", "KIOSK_PREPARING");
}

export function toKioskReference(payment: {
  merchantOrderId: string;
  kioskReference: string | null;
  amount: number;
  expiresAt: Date | null;
}): KioskReference | null {
  if (!payment.kioskReference || !payment.expiresAt) return null;
  return {
    merchantOrderId: payment.merchantOrderId,
    reference: payment.kioskReference,
    amount: payment.amount,
    expiresAt: payment.expiresAt,
  };
}

/** Can this reference still be handed to the student for this price? */
function isOfferable(
  payment: { kioskReference: string | null; amountCents: number; expiresAt: Date | null },
  amountCents: number,
): boolean {
  return (
    !!payment.kioskReference &&
    payment.amountCents === amountCents &&
    !!payment.expiresAt &&
    payment.expiresAt.getTime() - Date.now() > kioskMinLeftMs()
  );
}

/**
 * The student's open kiosk payment for a course: `open` when it can be handed
 * out again. One that can't — run out, made for an old price, or never given
 * a reference — stops being offered (moved off "pending", which also frees
 * the one-open-reference slot); its number comes back as `replaced`, so the
 * new reference's message can say not to pay it.
 */
export async function takeOpenKioskPayment(
  userId: string | Types.ObjectId,
  courseId: Types.ObjectId,
  amountCents: number,
): Promise<{ open: PaymentDocument | null; replaced: string | null }> {
  const open = await Payment.findOne({
    userId,
    courseId,
    method: PAYMENT_METHOD.KIOSK,
    status: PAYMENT_STATUS.PENDING,
  });
  if (!open) return { open: null, replaced: null };
  if (isOfferable(open, amountCents)) return { open, replaced: null };
  if (!open.kioskReference && Date.now() - open.createdAt.getTime() < KIOSK_PREPARING_MS) {
    throw kioskPreparing(); // another tab / click is getting it right now
  }
  await Payment.updateOne(
    { _id: open._id, status: PAYMENT_STATUS.PENDING },
    { $set: { status: PAYMENT_STATUS.FAILED } },
  );
  return { open: null, replaced: open.kioskReference };
}

/**
 * Is paying cash at Aman / Masary switched on (its integration id set)? When
 * it's off, nothing about it is shown to students — not even references made
 * before it was switched off. A payment made with one anyway is still settled
 * (webhook / safety net), so no money is ever ignored.
 */
export function isKioskOffered(): boolean {
  return availablePaymentMethods().includes(PAYMENT_METHOD.KIOSK);
}

/**
 * The still-offerable kiosk reference a student has for a course — shown on
 * the course and checkout pages, so leaving checkout never loses it.
 */
export async function getPendingKioskPayment(
  userId: string | Types.ObjectId,
  course: { _id: Types.ObjectId; price: number },
): Promise<KioskReference | null> {
  if (!isKioskOffered()) return null;
  const payment = await Payment.findOne({
    userId,
    courseId: course._id,
    method: PAYMENT_METHOD.KIOSK,
    status: PAYMENT_STATUS.PENDING,
  }).lean();
  if (!payment || !isOfferable(payment, Math.round(course.price * 100))) return null;
  return toKioskReference(payment);
}

// ── WhatsApp, to the student's own number (best effort, never blocks) ───────

/** "الخميس ٢٧ أكتوبر، ٩:٣٠ م" in Egypt's time, for the deadline in messages. */
const CAIRO_TIME = new Intl.DateTimeFormat("ar-EG", {
  timeZone: "Africa/Cairo",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

function sendBestEffort(phone: string, text: string, what: string): void {
  void sendWhatsappText(phone, text).catch((err: unknown) =>
    logger.warn(`[payments] ${what} not sent`, {
      error: err instanceof Error ? err.message : err,
    }),
  );
}

/** The new reference, how to pay it, and (when it replaces one) not to pay the old. */
export function sendKioskReference(input: {
  phone: string;
  courseTitle: string;
  reference: KioskReference;
  replaced: string | null;
}): void {
  const { reference: ref } = input;
  const lines = [
    `رقم الدفع لكورس «${input.courseTitle}» على ${platformName()}: ${ref.reference}`,
    `المبلغ: ${ref.amount} جنيه`,
    "ادفعه كاش في أي محل عليه علامة أمان أو مصاري: قول للبياع إنك عايز تدفع لـ «Paymob / Accept» وإديله الرقم ده.",
    `الرقم شغال لحد ${CAIRO_TIME.format(ref.expiresAt)}، والكورس هيتفتحلك تلقائي أول ما تدفع.`,
  ];
  if (input.replaced && input.replaced !== ref.reference) {
    lines.push(`ده بدل الرقم القديم ${input.replaced} — متدفعش القديم.`);
  }
  lines.push("لو دفعت الكورس بطريقة تانية، متدفعش الرقم ده.");
  sendBestEffort(input.phone, lines.join("\n"), "kiosk reference WhatsApp");
}

/** Paid at an outlet, away from the site: tell the student the course is open. */
export async function notifyKioskPaid(
  userId: Types.ObjectId,
  courseId: Types.ObjectId,
): Promise<void> {
  try {
    const [user, course] = await Promise.all([
      User.findById(userId).select("studentPhone").lean(),
      Course.findById(courseId).select("title").lean(),
    ]);
    if (!user?.studentPhone || !course) return;
    sendBestEffort(
      user.studentPhone,
      [
        "وصلنا الدفع ✅",
        `كورس «${course.title}» اتفتحلك على ${platformName()} — تقدر تبدأ تتفرج دلوقتي. بالتوفيق 🤍`,
      ].join("\n"),
      "kiosk paid WhatsApp",
    );
  } catch (err) {
    logger.warn("[payments] kiosk paid WhatsApp not sent", {
      error: err instanceof Error ? err.message : err,
    });
  }
}

/**
 * The course just opened for the student (by any route): references they
 * still hold for it stop being offered, and they're told not to pay them —
 * a parent paying an old number later would be a second charge. Never throws.
 */
export async function withdrawOpenKioskReferences(
  userId: string | Types.ObjectId,
  courseId: string | Types.ObjectId,
): Promise<void> {
  try {
    const open = await Payment.find({
      userId,
      courseId,
      method: PAYMENT_METHOD.KIOSK,
      status: PAYMENT_STATUS.PENDING,
    })
      .select("kioskReference")
      .lean();
    // One by one, so a reference that got paid in the meantime isn't listed.
    const numbers: string[] = [];
    for (const p of open) {
      const { modifiedCount } = await Payment.updateOne(
        { _id: p._id, status: PAYMENT_STATUS.PENDING },
        { $set: { status: PAYMENT_STATUS.FAILED } },
      );
      if (modifiedCount && p.kioskReference) numbers.push(p.kioskReference);
    }
    if (numbers.length === 0) return;
    const [user, course] = await Promise.all([
      User.findById(userId).select("studentPhone").lean(),
      Course.findById(courseId).select("title").lean(),
    ]);
    if (!user?.studentPhone || !course) return;
    sendBestEffort(
      user.studentPhone,
      [
        `كورس «${course.title}» اتفتحلك خلاص على ${platformName()} ✅`,
        `رقم الدفع ${numbers.join(" و ")} مبقاش مطلوب — متدفعهوش في أمان أو مصاري، عشان الفلوس متتدفعش مرتين.`,
      ].join("\n"),
      "kiosk withdrawn WhatsApp",
    );
  } catch (err) {
    logger.warn("[payments] withdrawing kiosk references failed", {
      error: err instanceof Error ? err.message : err,
    });
  }
}
