import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import { STAGES, type Stage } from "../../config/constants";

/**
 * Represents a student user in the system.
 * Created on registration; must be activated (isActive=true) by admin before
 * the student can access lessons.
 */
export interface IUser {
  firstName: string;
  secondName: string;
  thirdName: string;
  studentPhone: string;   // unique Egyptian mobile number used as login identifier
  parentPhone: string;
  passwordHash: string;   // bcrypt hash — never stored in plaintext
  stage: Stage;           // academic stage (prep3 / sec1 / sec3)
  isActive: boolean;      // false until admin manually activates the account
  isSuspended: boolean;   // true when admin suspends the account
  failedLoginAttempts: number;  // failed login counter; triggers lockout at MAX_LOGIN_ATTEMPTS
  lockedUntil: Date | null; // temporary lockout expiry (null = not locked)
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

/**
 * Mongoose schema for the User model.
 */
const userSchema = new Schema<IUser>(
  {
    /**
     * First name of the student.
     */
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    /**
     * Second name of the student.
     */
    secondName: { type: String, required: true, trim: true, maxlength: 50 },
    /**
     * Third name of the student.
     */
    thirdName: { type: String, required: true, trim: true, maxlength: 50 },
    /**
     * Unique Egyptian mobile number used as login identifier.
     */
    studentPhone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      match: [/^01[0-25]\d{8}$/, "Invalid Egyptian phone number"],
    },
    parentPhone: {
      type: String,
      required: true,
      trim: true,
      match: [/^01[0-25]\d{8}$/, "Invalid Egyptian phone number"],
    },
    passwordHash: { type: String, required: true, select: false },
    stage: {
      type: String,
      required: true,
      enum: Object.values(STAGES),
      index: true,
    },
    isActive: { type: Boolean, default: false, index: true },
    isSuspended: { type: Boolean, default: false, index: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.secondName} ${this.thirdName}`.trim();
});

userSchema.methods.isLocked = function (): boolean {
  return !!this.lockedUntil && this.lockedUntil > new Date();
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
