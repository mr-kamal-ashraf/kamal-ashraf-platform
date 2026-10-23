import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  REFUND_REASON,
  type PaymentMethod,
  type PaymentStatus,
  type RefundReason,
} from "../../config/constants";

/**
 * Records a single online payment attempt through Paymob for a course — by
 * card or mobile wallet (`method`).
 *
 * Lifecycle:
 *   1. Created with status = pending when the student starts checkout
 *      (after we obtain a Paymob order id + payment key).
 *   2. Flipped to paid | failed by the HMAC-verified Paymob webhook.
 *   3. On "paid", an Enrollment is created/activated and linked back here.
 *
 * merchantOrderId is OUR own unique id sent to Paymob as merchant_order_id; it
 * lets us correlate the webhook back to this record and prevents Paymob's
 * "duplicate order" errors on retries.
 */
export interface IPayment {
  userId: Types.ObjectId;             // student who is paying
  courseId: Types.ObjectId;           // course being bought
  amount: number;                     // EGP whole pounds (course price snapshot)
  amountCents: number;                // piastres actually sent to Paymob (amount * 100)
  currency: string;                   // always "EGP" for now
  status: PaymentStatus;              // pending | paid | failed
  provider: string;                   // "paymob"
  method: PaymentMethod;              // card | wallet
  checkedAt: Date | null;             // last time we asked Paymob about it (safety net throttle)
  merchantOrderId: string;            // our unique id (merchant_order_id)
  paymobOrderId: string | null;       // Paymob's order id
  paymobTransactionId: string | null; // Paymob's transaction id from the callback
  paymentKeyToken: string | null;     // payment key used for the iframe (debug/trace)
  hmacVerified: boolean;              // whether the callback HMAC signature checked out
  paidAt: Date | null;                // when the payment was confirmed
  raw: Record<string, unknown> | null; // last raw webhook payload (debugging)
  refundReason: RefundReason | null;  // paid, but should go back to the student (see REFUND_REASON)
  refundResolvedAt: Date | null;      // the teacher dealt with it (refunded / opened the course)
  refundResolvedBy: Types.ObjectId | null; // the admin who marked it dealt with
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentDocument = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "EGP" },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    provider: { type: String, default: "paymob" },
    method: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      default: PAYMENT_METHOD.CARD,
    },
    checkedAt: { type: Date, default: null },
    merchantOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymobOrderId: { type: String, default: null, index: true },
    paymobTransactionId: { type: String, default: null, index: true },
    paymentKeyToken: { type: String, default: null },
    hmacVerified: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    raw: { type: Schema.Types.Mixed, default: null },
    refundReason: {
      type: String,
      enum: [...Object.values(REFUND_REASON), null],
      default: null,
    },
    refundResolvedAt: { type: Date, default: null },
    refundResolvedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        delete ret.raw;
        return ret;
      },
    },
  }
);

paymentSchema.index({ userId: 1, courseId: 1, status: 1 });
// The teacher's "refund these" list: only the few flagged payments are indexed.
paymentSchema.index(
  { refundResolvedAt: 1, paidAt: -1 },
  { partialFilterExpression: { refundReason: { $type: "string" } } },
);

export const Payment: Model<IPayment> =
  mongoose.models.Payment ||
  mongoose.model<IPayment>("Payment", paymentSchema);
