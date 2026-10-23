import type { Request, Response } from "express";
import { Types } from "mongoose";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as userService from "./user.service";
import * as enrollmentService from "../enrollments/enrollment.service";
import { revokeSession } from "../sessions/session.service";
import { recordAuditLog } from "../audit-logs/audit-log.service";
import { AUDIT_ACTIONS } from "../audit-logs/audit-log.model";
import type { Stage } from "../../config/constants";
import {
  listStudentsQuerySchema,
  type ListStudentsQuery,
  type AdminResetPasswordInput,
  type GrantCourseAccessInput,
  type BulkStudentActionInput,
} from "./user.validation";
import type { CommitmentLevel } from "../progress/commitment.service";

/**
 * GET /admin/students
 * Returns a paginated list of students with optional filters
 * (stage, status, search term).
 */
export async function list(req: Request, res: Response) {
  // Parsed here rather than trusting the raw query: Express 5 keeps req.query
  // read-only, so the validate() middleware cannot hand back the coerced
  // page/limit numbers. A ZodError thrown here surfaces as the same 422.
  const query = listStudentsQuerySchema.parse(req.query) as ListStudentsQuery;
  const result = await userService.listStudents({
    ...query,
    stage: query.stage as Stage | undefined,
    commitment: query.commitment as CommitmentLevel | undefined,
  });
  return sendSuccess(res, { data: result });
}

/**
 * GET /admin/students/:id
 * Returns full student detail including subscription history,
 * watch history, and active sessions.
 */
export async function detail(req: Request, res: Response) {
  const data = await userService.getStudentDetail(req.params.id);
  return sendSuccess(res, { data });
}

/** POST /admin/students/bulk-action — applies an account action to selected students. */
export async function bulkAction(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = req.body as BulkStudentActionInput;
  const result = await userService.applyBulkStudentAction(
    input.studentIds,
    input.action,
  );

  const auditAction =
    input.action === "suspend"
      ? AUDIT_ACTIONS.SUSPEND_USER
      : input.action === "unsuspend"
        ? AUDIT_ACTIONS.UNSUSPEND_USER
        : AUDIT_ACTIONS.DELETE_USER;

  await Promise.all(
    result.processedIds.map((studentId) => {
      const deleted = result.deletedSnapshots.get(studentId);
      return recordAuditLog({
        adminId: req.user!.id,
        action: auditAction,
        targetUserId: studentId,
        metadata: {
          bulk: true,
          ...(deleted ?? {}),
        },
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      });
    }),
  );

  const actionLabel =
    input.action === "suspend"
      ? "تعليق"
      : input.action === "unsuspend"
        ? "إعادة تفعيل"
        : "حذف";

  return sendSuccess(res, {
    message: `تم ${actionLabel} ${result.processedIds.length} طالب`,
    data: {
      action: input.action,
      requested: input.studentIds.length,
      processed: result.processedIds.length,
      missingIds: result.missingIds,
      failedIds: result.failedIds,
    },
  });
}

/**
 * POST /admin/students/:id/suspend
 * Suspends the student account and revokes all their active sessions immediately.
 */
export async function suspend(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const user = await userService.setSuspended(req.params.id, true);
  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.SUSPEND_USER,
    targetUserId: user._id,
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });
  return sendSuccess(res, {
    message: "تم تعليق الحساب",
    data: { user: user.toJSON() },
  });
}

/**
 * POST /admin/students/:id/unsuspend
 * Lifts the suspension and allows the student to log in again.
 */
export async function unsuspend(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const user = await userService.setSuspended(req.params.id, false);
  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.UNSUSPEND_USER,
    targetUserId: user._id,
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });
  return sendSuccess(res, {
    message: "تم إعادة تفعيل الحساب",
    data: { user: user.toJSON() },
  });
}

/**
 * POST /admin/students/:id/reset-password
 * Resets the student's password without requiring the old one.
 * Also resets failed-login counter and lockout.
 */
export async function resetPassword(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const { newPassword } = req.body as AdminResetPasswordInput;
  await userService.adminResetPassword(req.params.id, newPassword);
  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.RESET_USER_PASSWORD,
    targetUserId: req.params.id,
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });
  return sendSuccess(res, { message: "تم تغيير كلمة سر الطالب" });
}

/**
 * POST /admin/students/:id/courses/:courseId/grant
 * Manually opens a course for a student who paid cash in person. Records the
 * course price as amountPaid and marks the enrollment source as "cash".
 */
export async function grantCourse(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  if (
    !Types.ObjectId.isValid(req.params.id) ||
    !Types.ObjectId.isValid(req.params.courseId)
  ) {
    throw ApiError.badRequest("معرف الطالب أو الكورس غير صالح", "INVALID_ID");
  }
  const input = req.body as GrantCourseAccessInput;

  const { enrollment, newlyGranted } = await enrollmentService.grantCashAccess({
    userId: req.params.id,
    courseId: req.params.courseId,
    grantedBy: req.user.id,
    notes: input.notes ?? null,
    amountPaid: input.amountPaid,
  });

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.GRANT_COURSE_ACCESS,
    targetUserId: req.params.id,
    targetCourseId: req.params.courseId,
    metadata: {
      amountPaid: enrollment.amountPaid,
      source: enrollment.source,
      newlyGranted,
    },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: newlyGranted ? "تم فتح الكورس للطالب" : "الطالب مشترك بالفعل",
    data: { enrollment: enrollment.toJSON() },
  });
}

/**
 * DELETE /admin/students/:id/courses/:courseId
 * Revokes a student's access to a course (e.g. refund / mistake).
 */
export async function revokeCourse(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  if (
    !Types.ObjectId.isValid(req.params.id) ||
    !Types.ObjectId.isValid(req.params.courseId)
  ) {
    throw ApiError.badRequest("معرف الطالب أو الكورس غير صالح", "INVALID_ID");
  }
  await enrollmentService.revokeCourseAccess(
    req.params.id,
    req.params.courseId,
    req.user.id,
  );

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.REVOKE_COURSE_ACCESS,
    targetUserId: req.params.id,
    targetCourseId: req.params.courseId,
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, { message: "تم سحب الكورس من الطالب" });
}

/**
 * DELETE /admin/students/:id/sessions/:sessionId
 * Force-terminates a specific student session (e.g. if a device is stolen).
 */
export async function revokeStudentSession(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await revokeSession(req.params.sessionId, "ADMIN_REVOKED");
  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.REVOKE_USER_SESSION,
    targetUserId: req.params.id,
    metadata: { sessionId: req.params.sessionId },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });
  return sendSuccess(res, { message: "تم إنهاء الجلسة" });
}

/**
 * DELETE /admin/students/:id
 * Permanently deletes a student and ALL their data (progress, enrollments,
 * payments, sessions, support escalations). Irreversible. Records a DELETE_USER
 * audit entry with a snapshot of who was removed.
 */
export async function deleteStudent(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  if (!Types.ObjectId.isValid(req.params.id)) {
    throw ApiError.badRequest("معرف الطالب غير صالح", "INVALID_ID");
  }

  const { deletedName, deletedPhone } =
    await userService.deleteStudentPermanently(req.params.id);

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.DELETE_USER,
    targetUserId: req.params.id,
    metadata: { deletedName, deletedPhone },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, { message: "تم حذف الطالب وكل بياناته نهائيًا" });
}
