import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";

/**
 * All possible admin actions that can be recorded in the audit log.
 * Every time an admin performs a sensitive action (login, subscription grant,
 * lesson publish, etc.) a document is created with one of these action codes.
 * This provides a tamper-evident record of all admin activity.
 */
export const AUDIT_ACTIONS = {
  ADMIN_LOGIN: "ADMIN_LOGIN",
  ADMIN_LOGOUT: "ADMIN_LOGOUT",
  ACTIVATE_SUBSCRIPTION: "ACTIVATE_SUBSCRIPTION",
  EXTEND_SUBSCRIPTION: "EXTEND_SUBSCRIPTION",
  CANCEL_SUBSCRIPTION: "CANCEL_SUBSCRIPTION",
  ACTIVATE_USER: "ACTIVATE_USER",
  SUSPEND_USER: "SUSPEND_USER",
  UNSUSPEND_USER: "UNSUSPEND_USER",
  RESET_USER_PASSWORD: "RESET_USER_PASSWORD",
  DELETE_USER: "DELETE_USER",
  REVOKE_USER_SESSION: "REVOKE_USER_SESSION",
  CREATE_LESSON: "CREATE_LESSON",
  UPDATE_LESSON: "UPDATE_LESSON",
  DELETE_LESSON: "DELETE_LESSON",
  PUBLISH_LESSON: "PUBLISH_LESSON",
  UNPUBLISH_LESSON: "UNPUBLISH_LESSON",
  CREATE_COURSE: "CREATE_COURSE",
  UPDATE_COURSE: "UPDATE_COURSE",
  DELETE_COURSE: "DELETE_COURSE",
  PUBLISH_COURSE: "PUBLISH_COURSE",
  UNPUBLISH_COURSE: "UNPUBLISH_COURSE",
  GRANT_COURSE_ACCESS: "GRANT_COURSE_ACCESS",
  REVOKE_COURSE_ACCESS: "REVOKE_COURSE_ACCESS",
  GENERATE_COURSE_CODES: "GENERATE_COURSE_CODES",
  DISABLE_COURSE_CODE: "DISABLE_COURSE_CODE",
  ENABLE_COURSE_CODE: "ENABLE_COURSE_CODE",
  DELETE_COURSE_CODES: "DELETE_COURSE_CODES",
  RESOLVE_REFUND_ALERT: "RESOLVE_REFUND_ALERT",
  CHANGE_ADMIN_PASSWORD: "CHANGE_ADMIN_PASSWORD",
  UPDATE_SITE_SETTINGS: "UPDATE_SITE_SETTINGS",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * A single audit log entry.
 * Records which admin performed an action, on which resource, and from where.
 * updatedAt is disabled — audit log entries are immutable once written.
 */
export interface IAuditLog {
  adminId: Types.ObjectId;               // the admin who performed the action
  action: AuditAction;                   // what they did
  targetUserId: Types.ObjectId | null;   // affected student (if applicable)
  targetLessonId: Types.ObjectId | null; // affected lesson (if applicable)
  targetSubscriptionId: Types.ObjectId | null; // affected subscription (if applicable)
  targetCourseId: Types.ObjectId | null; // affected course (if applicable)
  metadata: Record<string, unknown>;     // extra context (e.g. sessionId, daysGranted)
  ipAddress: string;                     // admin's IP address at the time
  userAgent: string;                     // admin's browser user-agent
  createdAt: Date;
}

export type AuditLogDocument = HydratedDocument<IAuditLog>;

const auditLogSchema = new Schema<IAuditLog>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: Object.values(AUDIT_ACTIONS),
      index: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    targetLessonId: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      default: null,
    },
    targetSubscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    targetCourseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for sorting the audit log chronologically (newest first).
auditLogSchema.index({ createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
