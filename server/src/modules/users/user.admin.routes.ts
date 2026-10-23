import { Router } from "express";
import {
  list,
  detail,
  bulkAction,
  suspend,
  unsuspend,
  resetPassword,
  grantCourse,
  revokeCourse,
  revokeStudentSession,
  deleteStudent,
} from "./user.admin.controller";
import {
  adminResetPasswordSchema,
  grantCourseAccessSchema,
  bulkStudentActionSchema,
} from "./user.validation";
import { validate } from "../../shared/middlewares/validate.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = Router();

// ── Student list & detail ────────────────────────────────────────────────────────
/**
 * GET /admin/students
 * Returns a paginated list of all student accounts for the admin dashboard.
 * Supports filtering by stage, account status, this month's commitment band,
 * and a search query. The query string is parsed inside the controller (see
 * the note there), so no validate() middleware is attached here.
 */
router.get("/", asyncHandler(list));

/**
 * POST /admin/students/bulk-action
 * Applies suspend, unsuspend, or permanent delete to a selected group. This
 * MUST be registered before /:id so Express does not treat "bulk-action" as
 * a student id.
 */
router.post(
  "/bulk-action",
  validate(bulkStudentActionSchema),
  asyncHandler(bulkAction),
);
/**
 * GET /admin/students/:id
 * Returns full details of a single student including profile, subscription, sessions, and watch history.
 * Used by the admin "Student Details" page.
 */
router.get("/:id", asyncHandler(detail));

// ── Account management ──────────────────────────────────────────────────────
/**
 * POST /admin/students/:id/suspend
 * Temporarily suspends a student account (blocks login and access to lessons).
 * The student will see a "suspended" message on their next request.
 */
router.post("/:id/suspend", asyncHandler(suspend));
/**
 * POST /admin/students/:id/unsuspend
 * Reverses a suspension and restores the student's full access to the platform.
 */
router.post("/:id/unsuspend", asyncHandler(unsuspend));
/**
 * POST /admin/students/:id/reset-password
 * Allows an admin to forcibly reset a student's password (e.g., upon request).
 * The new password is set directly — no email verification required.
 */
router.post(
  "/:id/reset-password",
  validate(adminResetPasswordSchema),
  asyncHandler(resetPassword),
);

/**
 * DELETE /admin/students/:id
 * Permanently deletes a student account and every record tied to them.
 * Irreversible — the admin UI gates this behind an explicit confirmation.
 */
router.delete("/:id", asyncHandler(deleteStudent));

// ── Course access (manual / cash enrollment) ──────────────────────────────────
/**
 * POST /admin/students/:id/courses/:courseId/grant
 * Opens a course for a student who paid cash in person (admin-only).
 */
router.post(
  "/:id/courses/:courseId/grant",
  validate(grantCourseAccessSchema),
  asyncHandler(grantCourse),
);
/**
 * DELETE /admin/students/:id/courses/:courseId
 * Revokes a student's access to a course.
 */
router.delete("/:id/courses/:courseId", asyncHandler(revokeCourse));

// ── Session management ────────────────────────────────────────────────────────
/**
 * DELETE /admin/students/:id/sessions/:sessionId
 * Revokes a specific active session of a student (forces logout from that device).
 * The student must re-login on the revoked device.
 */
router.delete("/:id/sessions/:sessionId", asyncHandler(revokeStudentSession));

export default router;
