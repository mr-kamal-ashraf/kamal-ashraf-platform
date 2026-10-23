import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

/**
 * Represents an admin user. Admins manage students, subscriptions, lessons, and
 * audit logs. There is typically one admin (seeded from .env) but the schema
 * supports multiple.
 *
 * passwordHash is excluded from queries by default (select: false) and must
 * be explicitly requested when needed for password verification.
 */
export interface IAdmin {
  email: string;                  // unique login identifier
  passwordHash: string;           // bcrypt hash — never returned in API responses
  name: string;                   // display name shown in the UI
  failedLoginAttempts: number;    // increments on each wrong password
  lockedUntil: Date | null;       // account temporarily locked after too many failures
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AdminDocument = HydratedDocument<IAdmin>;

const adminSchema = new Schema<IAdmin>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"],
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Admin: Model<IAdmin> =
  mongoose.models.Admin || mongoose.model<IAdmin>("Admin", adminSchema);
