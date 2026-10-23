import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import {
  STAGES,
  type Stage,
  ENROLLMENT_SOURCE,
  ENROLLMENT_STATUS,
  type EnrollmentSource,
  type EnrollmentStatus,
} from "../../config/constants";

/**
 * Represents a student's OWNERSHIP of a course — the single source of truth
 * for lesson access. A student can watch a course's lessons only while an
 * enrollment for (userId, courseId) exists with status = active.
 *
 * Three ways an enrollment is created:
 *   - source = "paymob": student paid online; paymentId links the Payment record.
 *   - source = "cash":   admin opened the course manually after cash-in-hand;
 *                        grantedBy links the admin who did it.
 *   - source = "code":   student redeemed a prepaid course code (notes holds
 *                        the code; the CourseCode records who used it).
 *
 * One enrollment per (userId, courseId) — re-granting after a revoke reuses and
 * re-activates the same document rather than creating a duplicate.
 */
export interface IEnrollment {
  userId: Types.ObjectId;                 // the student who owns the course
  courseId: Types.ObjectId;               // the course they own
  stage: Stage;                           // snapshot of the course stage at grant time
  source: EnrollmentSource;               // paymob | cash
  amountPaid: number;                     // EGP recorded at grant time (course price)
  status: EnrollmentStatus;               // active | revoked
  grantedBy: Types.ObjectId | null;       // admin who granted (cash/manual only)
  paymentId: Types.ObjectId | null;       // linked Payment (paymob only)
  notes: string | null;                   // optional admin notes for a manual grant
  revokedAt: Date | null;                 // set when admin revokes access
  grantedAt: Date | null;                 // when access was last opened (first grant, or again after a revoke) — the sale date; older records: null → createdAt
  revokedBy: Types.ObjectId | null;       // admin who revoked it
  createdAt: Date;
  updatedAt: Date;
}

export type EnrollmentDocument = HydratedDocument<IEnrollment>;

const enrollmentSchema = new Schema<IEnrollment>(
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
    stage: {
      type: String,
      required: true,
      enum: Object.values(STAGES),
    },
    source: {
      type: String,
      required: true,
      enum: Object.values(ENROLLMENT_SOURCE),
    },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: Object.values(ENROLLMENT_STATUS),
      default: ENROLLMENT_STATUS.ACTIVE,
      index: true,
    },
    grantedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    notes: { type: String, default: null, maxlength: 1000 },
    revokedAt: { type: Date, default: null },
    grantedAt: { type: Date, default: null },
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// One ownership record per (student, course).
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
// Fast "does this student own an active course" lookups.
enrollmentSchema.index({ userId: 1, status: 1 });
// Fast "who owns this course" lookups for admin/reporting.
enrollmentSchema.index({ courseId: 1, status: 1 });

export const Enrollment: Model<IEnrollment> =
  mongoose.models.Enrollment ||
  mongoose.model<IEnrollment>("Enrollment", enrollmentSchema);
