import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";

/**
 * A case the WhatsApp support agent could not (or should not) resolve on its
 * own and handed to the teacher. Two things happen when one is created:
 *   1) this record is saved (so it shows up in the admin panel), and
 *   2) a WhatsApp ping is sent to the teacher's number (best-effort).
 *
 * The agent NEVER performs money-related or irreversible actions itself — it
 * opens an escalation instead, and the teacher decides.
 */
export const ESCALATION_CATEGORY = {
  PAYMENT: "payment",       // refund / free access / payment dispute — always human-decided
  COMPLAINT: "complaint",   // a complaint the agent should not handle alone
  QUESTION: "question",     // a question the agent could not answer confidently
  OTHER: "other",
} as const;

export type EscalationCategory =
  (typeof ESCALATION_CATEGORY)[keyof typeof ESCALATION_CATEGORY];

export const ESCALATION_STATUS = {
  OPEN: "open",
  RESOLVED: "resolved",
} as const;

export type EscalationStatus =
  (typeof ESCALATION_STATUS)[keyof typeof ESCALATION_STATUS];

export interface ISupportEscalation {
  fromPhone: string;                 // the WhatsApp number that contacted support
  studentId: Types.ObjectId | null;  // resolved student (if the sender was known)
  studentName: string | null;        // snapshot of the student name at escalation time
  category: EscalationCategory;
  summary: string;                   // short agent-written summary of the request
  status: EscalationStatus;          // open | resolved
  teacherNotified: boolean;          // whether the WhatsApp ping to the teacher succeeded
  resolvedAt: Date | null;
  resolvedBy: Types.ObjectId | null; // admin who marked it resolved
  createdAt: Date;
  updatedAt: Date;
}

export type SupportEscalationDocument = HydratedDocument<ISupportEscalation>;

const escalationSchema = new Schema<ISupportEscalation>(
  {
    fromPhone: { type: String, required: true, trim: true, index: true },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    studentName: { type: String, default: null },
    category: {
      type: String,
      required: true,
      enum: Object.values(ESCALATION_CATEGORY),
      index: true,
    },
    summary: { type: String, required: true, maxlength: 2000 },
    status: {
      type: String,
      enum: Object.values(ESCALATION_STATUS),
      default: ESCALATION_STATUS.OPEN,
      index: true,
    },
    teacherNotified: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Newest-first listing of open cases for the admin inbox.
escalationSchema.index({ status: 1, createdAt: -1 });

export const SupportEscalation: Model<ISupportEscalation> =
  mongoose.models.SupportEscalation ||
  mongoose.model<ISupportEscalation>("SupportEscalation", escalationSchema);
