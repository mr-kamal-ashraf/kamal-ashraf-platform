import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import { ROLES, type Role } from "../../config/constants";

/**
 * Represents a login session for a student or admin.
 * One session = one device/browser. The session record stores a hash of the
 * refresh token so we can validate refresh requests without keeping the raw token.
 *
 * Sessions are revoked (revokedAt is set) on logout, password reset, or
 * when the admin force-terminates a session.
 * MongoDB's TTL index automatically deletes expired sessions from the DB.
 */
export interface ISession {
  userId: Types.ObjectId;                   // references User or Admin depending on role
  role: Role;                               // "student" or "admin" — determines which collection to join
  refreshTokenHash: string;                 // SHA-256 hash of the current refresh token
  previousRefreshTokenHash: string | null;  // hash of the last rotated token (used for reuse detection)
  userAgent: string;                        // browser/app user-agent string
  ipAddress: string;                        // IP at time of login
  deviceLabel: string;                      // human-readable device description (e.g. "Chrome on Windows")
  expiresAt: Date;                          // after this date the session is invalid
  lastActiveAt: Date;                       // updated on every successful token refresh
  rotatedAt: Date | null;                   // when the refresh token was last replaced (parallel-refresh grace)
  revokedAt: Date | null;                   // set when manually revoked; null = still active
  revokedReason: string | null;             // why it was revoked (e.g. "LOGOUT", "PASSWORD_RESET")
  createdAt: Date;
  updatedAt: Date;
}

export type SessionDocument = HydratedDocument<ISession>;

const sessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      refPath: "role",
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    refreshTokenHash: { type: String, required: true, index: true },
    previousRefreshTokenHash: { type: String, default: null, index: true },
    userAgent: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    deviceLabel: { type: String, default: "Unknown device" },
    expiresAt: { type: Date, required: true },
    lastActiveAt: { type: Date, default: Date.now },
    rotatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null, index: true },
    revokedReason: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.refreshTokenHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for listing a user's active sessions efficiently.
sessionSchema.index({ userId: 1, role: 1, revokedAt: 1, expiresAt: -1 });
// TTL index: MongoDB auto-deletes documents where expiresAt has passed.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>("Session", sessionSchema);
