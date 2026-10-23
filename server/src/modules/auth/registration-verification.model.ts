import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

/**
 * Short-lived proof that both phone numbers in a registration form are under
 * the applicant's control. Codes are bcrypt hashes only; plaintext codes never
 * reach MongoDB or any API response.
 */
export interface IRegistrationVerification {
  studentPhone: string;
  parentPhone: string;
  studentCodeHash: string;
  parentCodeHash: string;
  attempts: number;
  resendAvailableAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type RegistrationVerificationDocument =
  HydratedDocument<IRegistrationVerification>;

const registrationVerificationSchema = new Schema<IRegistrationVerification>(
  {
    studentPhone: { type: String, required: true, trim: true, index: true },
    parentPhone: { type: String, required: true, trim: true, index: true },
    studentCodeHash: { type: String, required: true, select: false },
    parentCodeHash: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0, min: 0 },
    resendAvailableAt: { type: Date, required: true },
    // MongoDB deletes the document automatically as soon as it expires.
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
);

// A phone pair has one current code pair. Requesting a fresh pair invalidates
// the old one once the resend cooldown has elapsed.
registrationVerificationSchema.index(
  { studentPhone: 1, parentPhone: 1 },
  { unique: true },
);

export const RegistrationVerification: Model<IRegistrationVerification> =
  mongoose.models.RegistrationVerification ||
  mongoose.model<IRegistrationVerification>(
    "RegistrationVerification",
    registrationVerificationSchema,
  );
