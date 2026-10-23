import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";

/**
 * A student's pending "forgot password" request: a six-digit code sent to
 * their own WhatsApp. Only the bcrypt hash is stored; the plaintext code never
 * reaches MongoDB or any API response. One live request per student — asking
 * again (after the cooldown) replaces it.
 */
export interface IPasswordReset {
  userId: Types.ObjectId;
  codeHash: string;
  attempts: number;
  resendAvailableAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PasswordResetDocument = HydratedDocument<IPasswordReset>;

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    codeHash: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0, min: 0 },
    resendAvailableAt: { type: Date, required: true },
    // MongoDB deletes the document automatically as soon as it expires.
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
);

export const PasswordReset: Model<IPasswordReset> =
  mongoose.models.PasswordReset ||
  mongoose.model<IPasswordReset>("PasswordReset", passwordResetSchema);
