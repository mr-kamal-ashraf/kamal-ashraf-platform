import { Types } from "mongoose";
import { nanoid } from "nanoid";
import { Payment, type PaymentDocument } from "./payment.model";
import { Course } from "../courses/course.model";
import { User } from "../users/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { logger } from "../../shared/utils/logger";
import {
  ACCESS_DENIAL_REASONS,
  DEFAULT_CURRENCY,
  ENROLLMENT_SOURCE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  REFUND_REASON,
  type PaymentMethod,
  type RefundReason,
} from "../../config/constants";
import { env } from "../../config/env";
import {
  getActiveEnrollment,
  grantCourseAccess,
  grantCourseAccessUnlessRevokedSince,
} from "../enrollments/enrollment.service";
import {
  assertMethodAvailable,
  getAuthToken,
  createOrder,
  getPaymentKey,
  buildIframeUrl,
  createCardIntention,
  inquireTransaction,
  isEmbeddedCardEnabled,
  payAtKiosk,
  payWithWallet,
  paymobPublicKey,
  verifyHmac,
} from "./paymob.client";
import {
  kioskPreparing,
  kioskTtlMs,
  notifyKioskPaid,
  sendKioskReference,
  takeOpenKioskPayment,
  toKioskReference,
  type KioskReference,
} from "./kiosk";

/** Card / wallet payment keys live an hour. */
const CHECKOUT_KEY_TTL_SECONDS = 60 * 60;

function isDuplicateKeyError(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === 11000;
}

interface CheckoutResult {
  free?: boolean;
  method?: PaymentMethod;
  paymentId?: string;
  /** Our order reference — the result page checks the payment by it. */
  merchantOrderId?: string;
  /** card, embedded: what the browser needs to render Paymob's card fields. */
  pixel?: { publicKey: string; clientSecret: string };
  /** card, otherwise: Paymob's checkout iframe page. */
  iframeUrl?: string;
  /** wallet: the wallet provider's confirmation page. */
  redirectUrl?: string;
  /** kiosk: the reference to pay with at Aman / Masary. */
  kiosk?: KioskReference;
  paymentToken?: string;
  amount: number;
  courseId: string;
  courseSlug: string;
}

/**
 * Starts a course purchase for a student.
 *
 * Guards, in order:
 *   - course exists and is published
 *   - course stage matches the student's registered stage (buying is stage-locked)
 *   - the student doesn't already own the course
 *
 * Free courses (price 0) are granted immediately with no Paymob round-trip.
 * Otherwise a pending Payment is created and the Paymob order + payment key are
 * obtained for the chosen method:
 *   - card:   with the secret + public keys set, a payment intention whose
 *             client secret renders Paymob's card fields inside our page;
 *             otherwise the iframe URL the student is redirected to;
 *   - wallet: the wallet provider page where they confirm with their PIN;
 *   - kiosk:  a reference number to pay in cash at Aman / Masary (also sent
 *             to their WhatsApp). Asking again while it's still offerable
 *             returns the same reference instead of a new order, and only one
 *             can be open per course (see kiosk.ts).
 * Every method ends at the same HMAC-verified webhook, which grants the course.
 */
export async function createCourseCheckout(input: {
  userId: string;
  courseId: string;
  method?: PaymentMethod;
  walletPhone?: string;
}): Promise<CheckoutResult> {
  const method = input.method ?? PAYMENT_METHOD.CARD;
  const [user, course] = await Promise.all([
    User.findById(input.userId).lean(),
    Course.findById(input.courseId),
  ]);
  if (!user) throw ApiError.unauthorized("المستخدم غير موجود", "USER_NOT_FOUND");
  if (!course || !course.isPublished) {
    throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");
  }

  if (course.stage !== user.stage) {
    throw ApiError.forbidden(
      "الكورس ده مش لمرحلتك، مش هتقدر تشتريه",
      ACCESS_DENIAL_REASONS.STAGE_MISMATCH,
    );
  }

  const existing = await getActiveEnrollment(input.userId, course._id);
  if (existing) {
    throw ApiError.conflict("إنت مشترك في الكورس ده بالفعل", "ALREADY_OWNED");
  }

  // Free course — grant immediately, skip the payment gateway entirely.
  if (course.price <= 0) {
    await grantCourseAccess({
      userId: input.userId,
      courseId: course._id,
      source: ENROLLMENT_SOURCE.CASH,
      amountPaid: 0,
      notes: "free course",
    });
    return {
      free: true,
      amount: 0,
      courseId: String(course._id),
      courseSlug: course.slug,
    };
  }

  // Never charge twice: an earlier payment for this course that went through
  // at Paymob but isn't recorded yet (a late or lost webhook) opens the
  // course now, instead of the student paying again.
  if (await reconcilePendingForCourse(input.userId, course._id)) {
    throw ApiError.conflict("إنت مشترك في الكورس ده بالفعل", "ALREADY_OWNED");
  }

  const amount = course.price;
  const courseRef = { amount, courseId: String(course._id), courseSlug: course.slug };

  const amountCents = Math.round(amount * 100);
  const kioskResult = (p: PaymentDocument): CheckoutResult => {
    const kiosk = toKioskReference(p);
    if (!kiosk) throw kioskPreparing();
    return { method, paymentId: String(p._id), merchantOrderId: p.merchantOrderId, kiosk, ...courseRef };
  };
  let replacedReference: string | null = null;
  if (method === PAYMENT_METHOD.KIOSK) {
    const taken = await takeOpenKioskPayment(input.userId, course._id, amountCents);
    if (taken.open) return kioskResult(taken.open);
    replacedReference = taken.replaced;
  }

  const merchantOrderId = `crs-${String(course._id)}-${nanoid(10)}`;
  const embeddedCard = method === PAYMENT_METHOD.CARD && isEmbeddedCardEnabled();
  // Fails fast (before any DB write) when the method isn't configured.
  let authToken = "";
  if (embeddedCard) assertMethodAvailable(method);
  else authToken = await getAuthToken(method);
  const billing = {
    first_name: user.firstName,
    last_name: `${user.secondName} ${user.thirdName}`.trim(),
    phone_number: input.walletPhone ?? user.studentPhone,
    email: `${user.studentPhone}@student.platform`,
  };

  const kioskTtl = kioskTtlMs();
  let payment: PaymentDocument;
  try {
    payment = await Payment.create({
      userId: input.userId,
      courseId: course._id,
      amount,
      amountCents,
      currency: DEFAULT_CURRENCY,
      status: PAYMENT_STATUS.PENDING,
      provider: "paymob",
      method,
      merchantOrderId,
      // Set before Paymob's key is made, so ours always ends first.
      ...(method === PAYMENT_METHOD.KIOSK
        ? { expiresAt: new Date(Date.now() + kioskTtl) }
        : {}),
    });
  } catch (err) {
    // A second click / tab got there first: hand back that one's reference.
    if (method === PAYMENT_METHOD.KIOSK && isDuplicateKeyError(err)) {
      const { open } = await takeOpenKioskPayment(input.userId, course._id, amountCents);
      if (open) return kioskResult(open);
      throw kioskPreparing();
    }
    throw err;
  }

  try {
    if (embeddedCard) {
      const intention = await createCardIntention({
        amountCents,
        currency: DEFAULT_CURRENCY,
        merchantOrderId,
        itemName: course.title,
        billing,
        expirationSeconds: CHECKOUT_KEY_TTL_SECONDS,
        redirectionUrl: `${env.CLIENT_URL.replace(/\/+$/, "")}/payment/callback`,
      });
      payment.paymobOrderId = intention.paymobOrderId;
      await payment.save();
      return {
        method,
        paymentId: String(payment._id),
        merchantOrderId,
        pixel: { publicKey: paymobPublicKey(), clientSecret: intention.clientSecret },
        ...courseRef,
      };
    }

    const orderId = await createOrder({
      authToken,
      amountCents,
      merchantOrderId,
      currency: DEFAULT_CURRENCY,
    });
    payment.paymobOrderId = orderId;
    await payment.save();

    const paymentToken = await getPaymentKey({
      method,
      authToken,
      amountCents,
      orderId,
      currency: DEFAULT_CURRENCY,
      expirationSeconds:
        method === PAYMENT_METHOD.KIOSK
          ? Math.round(kioskTtl / 1000)
          : CHECKOUT_KEY_TTL_SECONDS,
      billing,
    });
    payment.paymentKeyToken = paymentToken;
    await payment.save();

    if (method === PAYMENT_METHOD.KIOSK) {
      const kiosk = await payAtKiosk(paymentToken);
      payment.kioskReference = kiosk.reference;
      payment.paymobTransactionId = kiosk.transactionId;
      await payment.save();
      const result = kioskResult(payment);
      // Sent once, to the student's own number — asking again shows the same
      // reference without messaging them again.
      sendKioskReference({
        phone: user.studentPhone,
        courseTitle: course.title,
        reference: result.kiosk!,
        replaced: replacedReference,
      });
      return result;
    }

    if (method === PAYMENT_METHOD.WALLET) {
      const wallet = await payWithWallet(
        paymentToken,
        input.walletPhone ?? user.studentPhone,
      );
      payment.paymobTransactionId = wallet.transactionId;
      await payment.save();
      return {
        method,
        paymentId: String(payment._id),
        redirectUrl: wallet.redirectUrl,
        ...courseRef,
      };
    }

    return {
      method,
      paymentId: String(payment._id),
      iframeUrl: buildIframeUrl(paymentToken),
      paymentToken,
      ...courseRef,
    };
  } catch (err) {
    // Mark the pending payment as failed so it doesn't linger.
    payment.status = PAYMENT_STATUS.FAILED;
    await payment.save().catch(() => undefined);
    throw err;
  }
}

/**
 * Processes a Paymob transaction callback (server-to-server webhook).
 *
 * Verifies the HMAC signature, correlates it to our pending Payment, checks the
 * amount, then flips the payment to paid/failed. On a verified success it grants
 * the student ownership of the course (idempotently). Always resolves — the
 * caller responds 200 so Paymob stops retrying.
 */
export async function handlePaymobWebhook(
  body: Record<string, unknown>,
  hmacFromQuery: string | undefined,
): Promise<{ ok: boolean; reason?: string }> {
  const obj = (body?.obj ?? {}) as Record<string, unknown>;
  const hmac = hmacFromQuery ?? (body?.hmac as string | undefined);

  if (!obj || Object.keys(obj).length === 0) {
    return { ok: false, reason: "EMPTY_OBJ" };
  }

  const verified = verifyHmac(obj, hmac);
  if (!verified) {
    logger.warn("Paymob webhook HMAC verification failed", {
      transactionId: obj.id,
    });
    return { ok: false, reason: "BAD_HMAC" };
  }

  const order = (obj.order ?? {}) as Record<string, unknown>;
  const paymobOrderId = order.id !== undefined ? String(order.id) : null;
  const merchantOrderId =
    order.merchant_order_id !== undefined
      ? String(order.merchant_order_id)
      : null;

  const payment = await Payment.findOne(
    paymobOrderId
      ? { paymobOrderId }
      : { merchantOrderId: merchantOrderId ?? "__none__" },
  );

  if (!payment) {
    logger.warn("Paymob webhook: no matching payment", {
      paymobOrderId,
      merchantOrderId,
    });
    return { ok: false, reason: "PAYMENT_NOT_FOUND" };
  }

  return settleWithTransaction(payment, obj, "webhook");
}

/**
 * Applies a Paymob transaction to our payment — from the HMAC-verified webhook
 * or from our own inquiry to Paymob (the safety net). Pending stays pending;
 * a success with the right amount marks it paid and grants the course; the
 * paid transition is atomic, so a webhook and an inquiry landing together
 * grant once. The inquiry only ever settles successes: a failed attempt on a
 * card order can be followed by a successful retry on the same order, so
 * failures are left for the webhook to record.
 *
 * Every write is conditional on the payment not being paid yet: a decline
 * (or a "still pending" note) for an earlier attempt can be processed at the
 * same moment as the success, and must never overwrite it.
 */
async function settleWithTransaction(
  payment: PaymentDocument,
  obj: Record<string, unknown>,
  origin: "webhook" | "inquiry",
): Promise<{ ok: boolean; reason: string }> {
  // Idempotency — Paymob retries; don't double-grant.
  if (payment.status === PAYMENT_STATUS.PAID) {
    return { ok: true, reason: "ALREADY_PROCESSED" };
  }

  const success =
    obj.success === true || obj.success === "true" || obj.success === 1;
  const pending =
    obj.pending === true || obj.pending === "true" || obj.pending === 1;
  const amountCents = Number(obj.amount_cents ?? 0);
  const transactionId = obj.id !== undefined ? String(obj.id) : null;

  const record = {
    paymobTransactionId: transactionId,
    raw: obj,
    ...(origin === "webhook" ? { hmacVerified: true } : {}),
  };
  const recordUnlessPaid = (set: Record<string, unknown>) =>
    Payment.updateOne(
      { _id: payment._id, status: { $ne: PAYMENT_STATUS.PAID } },
      { $set: set },
    );

  // Not decided yet (a kiosk reference waiting to be paid at an outlet, a
  // wallet waiting for the PIN, a card at the bank's check): keep the payment
  // open — a later callback settles it.
  if (!success && pending) {
    await recordUnlessPaid(record);
    return { ok: true, reason: "STILL_PENDING" };
  }

  // Guard against a tampered/mismatched amount (or currency).
  const currency = obj.currency !== undefined ? String(obj.currency) : payment.currency;
  if (success && (amountCents !== payment.amountCents || currency !== payment.currency)) {
    await recordUnlessPaid({ ...record, status: PAYMENT_STATUS.FAILED });
    logger.error("Paymob amount mismatch", {
      origin,
      expected: `${payment.amountCents} ${payment.currency}`,
      got: `${amountCents} ${currency}`,
      paymentId: String(payment._id),
    });
    return { ok: false, reason: "AMOUNT_MISMATCH" };
  }

  if (!success) {
    if (origin === "inquiry") {
      await recordUnlessPaid(record);
      return { ok: true, reason: "NOT_PAID_YET" };
    }
    await recordUnlessPaid({ ...record, status: PAYMENT_STATUS.FAILED });
    return { ok: true, reason: "PAYMENT_FAILED" };
  }

  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: PAYMENT_STATUS.PAID } },
    { $set: { ...record, status: PAYMENT_STATUS.PAID, paidAt: new Date() } },
    { new: true },
  );
  if (!claimed) return { ok: true, reason: "ALREADY_PROCESSED" };

  // The teacher took the course back AFTER this payment was started: the
  // money is recorded, but an old payment (a late webhook, or the safety net
  // finding a forgotten one) never undoes that decision. Paying again after
  // the revoke opens it as usual.
  let granted;
  try {
    granted = await grantCourseAccessUnlessRevokedSince(
      {
        userId: claimed.userId,
        courseId: claimed.courseId,
        source: ENROLLMENT_SOURCE.PAYMOB,
        amountPaid: claimed.amount,
        paymentId: claimed._id,
      },
      claimed.createdAt,
    );
  } catch (err) {
    // Paid, but the course didn't open (a database hiccup): put the payment
    // back to pending so the next webhook or safety-net check finishes the
    // job — a "paid" record is never looked at again.
    await Payment.updateOne(
      { _id: claimed._id, status: PAYMENT_STATUS.PAID },
      { $set: { status: PAYMENT_STATUS.PENDING, paidAt: null } },
    ).catch(() => undefined);
    throw err;
  }
  // Money in, but no new access: flagged for the teacher (the refund list in
  // the sales section) — refund it, or open the course.
  const flagForRefund = (refundReason: RefundReason) =>
    Payment.updateOne({ _id: claimed._id }, { $set: { refundReason } });
  if (!granted) {
    await flagForRefund(REFUND_REASON.REVOKED_COURSE);
    logger.warn("Paid for a course revoked after the payment started — access not restored", {
      origin,
      userId: String(claimed.userId),
      courseId: String(claimed.courseId),
      paymentId: String(claimed._id),
    });
    return { ok: true, reason: "PAID_ACCESS_REVOKED" };
  }
  if (!granted.newlyGranted) {
    // The course was already open: this is a second charge to refund.
    await flagForRefund(REFUND_REASON.DUPLICATE);
    logger.warn("Paid for a course the student already had — refund the duplicate", {
      origin,
      userId: String(claimed.userId),
      courseId: String(claimed.courseId),
      paymentId: String(claimed._id),
    });
  }

  logger.info("Course purchase completed", {
    origin,
    userId: String(claimed.userId),
    courseId: String(claimed.courseId),
    paymentId: String(claimed._id),
  });

  // Paid at an outlet, away from the site: tell the student it's open.
  if (claimed.method === PAYMENT_METHOD.KIOSK && granted.newlyGranted) {
    void notifyKioskPaid(claimed.userId, claimed.courseId);
  }

  return { ok: true, reason: "GRANTED" };
}

// ── Safety net: ask Paymob ourselves ─────────────────────────────────────────
// The webhook can be late, lost, or (in local development) unable to reach us.
// When the student comes back from paying, or opens the course page with a
// payment still pending, we ask Paymob directly and settle it then.

/** Don't ask Paymob about the same payment more than once in this window. */
const RECHECK_AFTER_MS = 5 * 1000;
/**
 * Payments are checked for this long after checkout — at least three days,
 * and a day past a kiosk reference's deadline (it can be paid up to the end).
 */
const checkWindowMs = () =>
  Math.max(3 * 24 * 60 * 60 * 1000, kioskTtlMs() + 24 * 60 * 60 * 1000);

/**
 * Payments worth asking Paymob about: still pending, or declined — a card
 * declined once can be retried on the same Paymob order and go through. Not a
 * payment refused for a wrong amount (its recorded transaction was a success).
 */
function mayStillBePaid(payment: PaymentDocument): boolean {
  if (!payment.paymobOrderId) return false;
  if (payment.status === PAYMENT_STATUS.PENDING) return true;
  if (payment.status !== PAYMENT_STATUS.FAILED) return false;
  const raw = (payment.raw ?? {}) as Record<string, unknown>;
  return !(raw.success === true || raw.success === "true");
}

async function reconcilePayment(payment: PaymentDocument): Promise<boolean> {
  if (payment.status === PAYMENT_STATUS.PAID) return true;
  if (!mayStillBePaid(payment)) return false;
  // Claimed atomically: a burst of page loads asks Paymob once, not once each.
  const now = Date.now();
  const due = await Payment.updateOne(
    {
      _id: payment._id,
      $or: [
        { checkedAt: null },
        { checkedAt: { $lte: new Date(now - RECHECK_AFTER_MS) } },
      ],
    },
    { $set: { checkedAt: new Date(now) } },
  );
  if (due.modifiedCount === 0) return false;

  const obj = await inquireTransaction({
    paymobOrderId: payment.paymobOrderId,
    merchantOrderId: payment.merchantOrderId,
  });
  if (!obj) return false;
  const order = (obj.order ?? {}) as Record<string, unknown>;
  const sameOrder =
    String(order.id ?? "") === payment.paymobOrderId ||
    String(order.merchant_order_id ?? "") === payment.merchantOrderId;
  if (!sameOrder) return false;

  const result = await settleWithTransaction(payment, obj, "inquiry");
  return result.reason === "GRANTED" || result.reason === "ALREADY_PROCESSED";
}

/**
 * Checks the student's recent unpaid payments for a course with Paymob and
 * opens the course if one was paid. Never throws — a page load must not fail
 * because Paymob is slow.
 */
export async function reconcilePendingForCourse(
  userId: string | Types.ObjectId,
  courseId: string | Types.ObjectId,
): Promise<boolean> {
  try {
    const pending = await Payment.find({
      userId,
      courseId,
      status: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED] },
      paymobOrderId: { $ne: null },
      createdAt: { $gt: new Date(Date.now() - checkWindowMs()) },
    })
      .sort({ createdAt: -1 })
      .limit(3);
    for (const payment of pending) {
      if (await reconcilePayment(payment)) {
        // Settled — but only an active enrollment means the course is open.
        return !!(await getActiveEnrollment(userId, courseId));
      }
    }
  } catch (err) {
    logger.warn("[payments] reconcile failed", {
      error: err instanceof Error ? err.message : err,
    });
  }
  return false;
}

/**
 * The student is back from Paymob: settle that order now if it was paid.
 * Identified by our merchant order id or Paymob's order id, and only within
 * the student's own payments.
 */
export async function verifyPaymentForUser(input: {
  userId: string;
  merchantOrderId?: string;
  paymobOrderId?: string;
}): Promise<{ status: string; courseSlug: string | null }> {
  const match = input.merchantOrderId
    ? { merchantOrderId: input.merchantOrderId }
    : { paymobOrderId: input.paymobOrderId ?? "__none__" };
  const payment = await Payment.findOne({ userId: input.userId, ...match });
  if (!payment) {
    throw ApiError.notFound("مش لاقيين عملية الدفع دي", "PAYMENT_NOT_FOUND");
  }
  await reconcilePayment(payment).catch((err: unknown) =>
    logger.warn("[payments] verify failed", {
      error: err instanceof Error ? err.message : err,
    }),
  );
  const [fresh, course] = await Promise.all([
    Payment.findById(payment._id).select("status").lean(),
    Course.findById(payment.courseId).select("slug").lean(),
  ]);
  return { status: fresh?.status ?? payment.status, courseSlug: course?.slug ?? null };
}

/**
 * Returns a student's own payment history (most recent first) — without
 * Paymob's raw transaction or the payment key, which are ours to keep.
 */
export async function listPaymentsForUser(userId: string | Types.ObjectId) {
  return Payment.find({ userId })
    .select("-raw -paymentKeyToken -hmacVerified -checkedAt")
    .sort({ createdAt: -1 })
    .populate("courseId", "title slug stage thumbnail")
    .lean();
}

// ── Refunds to make (admin) ──────────────────────────────────────────────────

const OPEN_REFUND = {
  refundReason: { $type: "string" },
  refundResolvedAt: null,
} as const;

export interface RefundAlert {
  id: string;
  reason: RefundReason;
  amount: number;
  currency: string;
  method: PaymentMethod;
  paidAt: Date | null;
  merchantOrderId: string;
  paymobOrderId: string | null;
  paymobTransactionId: string | null;
  student: { id: string; name: string; studentPhone: string } | null;
  course: { id: string; title: string } | null;
}

/** How many paid payments are still waiting for the teacher to refund. */
export function countRefundAlerts(): Promise<number> {
  return Payment.countDocuments(OPEN_REFUND);
}

/**
 * The paid payments the teacher still has to deal with, newest first, with
 * what's needed to find each one in Paymob's dashboard.
 */
export async function listRefundAlerts(): Promise<RefundAlert[]> {
  const rows = await Payment.find(OPEN_REFUND)
    .sort({ paidAt: -1 })
    .limit(100)
    .populate<{
      userId: { _id: Types.ObjectId; firstName: string; secondName: string; thirdName: string; studentPhone: string } | null;
    }>("userId", "firstName secondName thirdName studentPhone")
    .populate<{ courseId: { _id: Types.ObjectId; title: string } | null }>("courseId", "title")
    .lean();
  return rows.map((p) => ({
    id: String(p._id),
    reason: p.refundReason as RefundReason,
    amount: p.amount,
    currency: p.currency,
    method: p.method,
    paidAt: p.paidAt,
    merchantOrderId: p.merchantOrderId,
    paymobOrderId: p.paymobOrderId,
    paymobTransactionId: p.paymobTransactionId,
    student: p.userId
      ? {
          id: String(p.userId._id),
          name: `${p.userId.firstName} ${p.userId.secondName} ${p.userId.thirdName}`.trim(),
          studentPhone: p.userId.studentPhone,
        }
      : null,
    course: p.courseId ? { id: String(p.courseId._id), title: p.courseId.title } : null,
  }));
}

/** The teacher refunded it (or opened the course): it leaves the list. */
export async function resolveRefundAlert(paymentId: string, adminId: string) {
  const payment = Types.ObjectId.isValid(paymentId)
    ? await Payment.findOneAndUpdate(
        { _id: paymentId, ...OPEN_REFUND },
        {
          $set: {
            refundResolvedAt: new Date(),
            refundResolvedBy: new Types.ObjectId(adminId),
          },
        },
        { new: true },
      ).lean()
    : null;
  if (!payment) {
    throw ApiError.notFound(
      "الدفعة دي مش في القايمة — يمكن اتعلّم عليها قبل كده.",
      "REFUND_ALERT_NOT_FOUND",
    );
  }
  return payment;
}
