import { Router } from "express";
import { authenticateAdmin } from "../shared/middlewares/auth.middleware";
import { asyncHandler } from "../shared/utils/asyncHandler";
import { getStats } from "../modules/admins/dashboard.controller";
import lessonAdminRoutes from "../modules/lessons/lesson.admin.routes";
import courseAdminRoutes from "../modules/courses/course.admin.routes";
import userAdminRoutes from "../modules/users/user.admin.routes";
import auditLogRoutes from "../modules/audit-logs/audit-log.routes";
import escalationAdminRoutes from "../modules/support/escalation.admin.routes";
import salesAdminRoutes from "../modules/sales/sales.admin.routes";
import paymentAdminRoutes from "../modules/payments/payment.admin.routes";
import courseCodeAdminRoutes from "../modules/course-codes/course-code.admin.routes";
import whatsappBridgeAdminRoutes from "../modules/whatsapp-bridge/whatsapp-bridge.admin.routes";
import { adminSettingsRoutes } from "../modules/site-settings/site-settings.routes";

const router = Router();

/**
 * Middleware: All routes below require a valid admin JWT from the admin cookie.
 * The authenticateAdmin() middleware rejects any request without a valid token
 * before it reaches any of the sub-routers below.
 */
router.use(authenticateAdmin());

// ── Sub-routers ─────────────────────────────────────────────────────────────────

/**
 * GET /admin/dashboard
 * Returns platform statistics for the admin dashboard overview.
 * Includes: total students, active subscriptions, lessons published, revenue overview.
 */
router.get("/dashboard", asyncHandler(getStats));

/**
 * Mounts the lesson admin sub-router at /admin/lessons.
 * Handles: lesson CRUD, publish toggle, video/thumbnail upload and deletion.
 */
router.use("/lessons", lessonAdminRoutes);

/**
 * Mounts the course admin sub-router at /admin/courses.
 * Handles: course CRUD, publish toggle, cover-image upload/removal.
 */
router.use("/courses", courseAdminRoutes);

/**
 * Mounts the student admin sub-router at /admin/students.
 * Handles: student list/detail, suspend/unsuspend, password reset, subscription management, session revocation.
 */
router.use("/students", userAdminRoutes);

/**
 * Mounts the audit log sub-router at /admin/audit-logs.
 * Provides read-only access to the platform audit trail for accountability.
 */
router.use("/audit-logs", auditLogRoutes);

/**
 * Mounts the support-agent escalation inbox at /admin/escalations.
 * Handles: list escalations (open/resolved), mark an escalation resolved.
 */
router.use("/escalations", escalationAdminRoutes);

/**
 * Mounts the sales report at /admin/sales.
 * Handles: sales list (online + cash), revenue summary, CSV export.
 */
router.use("/sales", salesAdminRoutes);

/**
 * Mounts payments that need the teacher at /admin/payments.
 * Handles: the list of paid payments to refund, marking one dealt with.
 */
router.use("/payments", paymentAdminRoutes);

/**
 * Mounts prepaid course codes at /admin/course-codes.
 * Handles: generating a batch, listing / searching, CSV export, the print
 * sheet, and switching an unused code off or on.
 */
router.use("/course-codes", courseCodeAdminRoutes);

/**
 * Mounts the WhatsApp bridge controls at /admin/whatsapp.
 * Handles: connection status, QR to link the number, logout (relink), restart.
 */
router.use("/whatsapp", whatsappBridgeAdminRoutes);

/**
 * Mounts the appearance & content editor at /admin/settings.
 * Handles: palette / theme mode, images per palette, hero texts & stats,
 * why-us features, FAQ, contact links, the announcement bar and the course
 * welcome popup.
 */
router.use("/settings", adminSettingsRoutes);

export default router;
