import { Router } from "express";
import { sendSuccess } from "../shared/utils/ApiResponse";
import authRoutes from "../modules/auth/auth.routes";
import adminAuthRoutes from "../modules/admin-auth/admin-auth.routes";
import lessonRoutes from "../modules/lessons/lesson.routes";
import courseRoutes from "../modules/courses/course.routes";
import paymentRoutes from "../modules/payments/payment.routes";
import courseCodeRoutes from "../modules/course-codes/course-code.routes";
import progressRoutes from "../modules/progress/progress.routes";
import adminRoutes from "./admin.routes";
import aiRoutes from "../modules/ai/ai.routes";
import internalRoutes from "../modules/internal/internal.routes";
import { publicSettingsRoutes } from "../modules/site-settings/site-settings.routes";

const router = Router();

// ── Health check ─────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Health check endpoint used by deployment platforms (Railway, Render, etc.)
 * to verify the server is running and responsive. Returns uptime and current timestamp.
 */
router.get("/health", (_req, res) => {
  sendSuccess(res, {
    message: "Server is healthy",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// ── Public / student routes ─────────────────────────────────────────────────────

/**
 * Mounts student authentication routes at /auth.
 * Handles: register, login, refresh token, logout, me, change-password.
 */
router.use("/auth", authRoutes);

/**
 * Mounts student lesson routes at /lessons.
 * Handles: public preview, lesson list (by stage), lesson detail, signed video URL.
 * Requires active subscription for non-preview routes.
 */
router.use("/lessons", lessonRoutes);

/**
 * Mounts student course routes at /courses.
 * Handles: public preview, course list (by stage, with owned flag), course
 * detail with its lessons (locked unless the student owns the course).
 */
router.use("/courses", courseRoutes);

/**
 * Mounts payment routes at /payments.
 * Handles: course checkout (Paymob), the HMAC-verified Paymob webhook, and the
 * student's own payment history.
 */
router.use("/payments", paymentRoutes);

/**
 * Mounts prepaid course codes at /course-codes.
 * Handles: a signed-in student redeeming a code to open its course.
 */
router.use("/course-codes", courseCodeRoutes);

/**
 * Mounts watch progress routes at /progress.
 * Handles: heartbeat updates, progress list, single lesson progress.
 * Requires active subscription.
 */
router.use("/progress", progressRoutes);

/**
 * Mounts the public site-settings read at /settings.
 * The website reads its palette, images and editable texts from here.
 */
router.use("/settings", publicSettingsRoutes);

// ── AI routes ───────────────────────────────────────────────────────────────────

/**
 * Mounts the AI proxy router at /ai.
 * Handles: student-chat (WF6), exam-generator (WF14), upload-curriculum (WF1),
 * and curriculum list/delete (WF9). Each route is user-authenticated (student
 * cookie for student-chat, admin cookie for the teacher-facing tools). The n8n
 * automation secret is added server-side in ai.service.ts — never exposed to
 * the frontend.
 */
router.use("/ai", aiRoutes);

// ── Admin routes ─────────────────────────────────────────────────────────────────

/**
 * Mounts admin authentication routes at /admin/auth.
 * Handles: admin login, refresh, logout, me.
 */
router.use("/admin/auth", adminAuthRoutes);

/**
 * Mounts the main admin router at /admin.
 * All sub-routes (dashboard, lessons, students, audit-logs) require admin authentication.
 */
router.use("/admin", adminRoutes);

// ── Internal (n8n-facing) routes ────────────────────────────────────────────────

/**
 * Mounts the n8n-facing internal router at /internal.
 * These endpoints are called SERVER-TO-SERVER by n8n workflows (WF5, WF7, WF8)
 * and are protected by X-Automation-Secret header only — no cookie auth. See
 * internal.routes.ts for the secret-rotation procedure.
 */
router.use("/internal", internalRoutes);

export default router;
