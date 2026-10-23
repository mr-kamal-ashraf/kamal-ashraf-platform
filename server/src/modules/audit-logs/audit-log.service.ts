import { Types } from "mongoose";
import {
  AuditLog,
  type AuditAction,
  type AuditLogDocument,
} from "./audit-log.model";
import { logger } from "../../shared/utils/logger";

interface RecordAuditLogInput {
  adminId: string | Types.ObjectId;
  action: AuditAction;
  targetUserId?: string | Types.ObjectId | null;
  targetLessonId?: string | Types.ObjectId | null;
  targetSubscriptionId?: string | Types.ObjectId | null;
  targetCourseId?: string | Types.ObjectId | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Writes a single audit log entry to the database.
 *
 * Errors are caught and logged rather than thrown — failing to write an audit
 * log should never crash the main request (it's a best-effort side effect).
 * Returns null on failure.
 */
export async function recordAuditLog(
  input: RecordAuditLogInput
): Promise<AuditLogDocument | null> {
  try {
    return await AuditLog.create({
      adminId: input.adminId,
      action: input.action,
      targetUserId: input.targetUserId ?? null,
      targetLessonId: input.targetLessonId ?? null,
      targetSubscriptionId: input.targetSubscriptionId ?? null,
      targetCourseId: input.targetCourseId ?? null,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? "",
      userAgent: input.userAgent ?? "",
    });
  } catch (err) {
    logger.error("Failed to record audit log", { error: err, input });
    return null;  // non-fatal: let the main request succeed even if logging failed
  }
}

interface ListAuditLogsInput {
  page?: number;
  limit?: number;
  action?: AuditAction;
  adminId?: string;
  targetUserId?: string;
}

/**
 * Returns a paginated list of audit log entries, newest first.
 * Supports optional filters: action type, admin, and target user.
 * Populates admin name/email and student name/phone for display in the UI.
 */
export async function listAuditLogs(input: ListAuditLogsInput = {}) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));

  const filter: Record<string, unknown> = {};
  if (input.action) filter.action = input.action;
  if (input.adminId) filter.adminId = input.adminId;
  if (input.targetUserId) filter.targetUserId = input.targetUserId;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })                   // newest entries first
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("adminId", "email name")         // include admin's name for display
      .populate("targetUserId", "firstName secondName thirdName studentPhone")
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
