import { Router } from "express";
import {
  listForStudent,
  getForStudent,
  getVideoUrlForStudent,
  listPublicPreview,
  getPublicPreview,
} from "./lesson.controller";
import { authenticateStudent } from "../../shared/middlewares/auth.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = Router();

// ── Public preview route (no auth required) ──────────────────────────────────

/**
 * GET /lessons/preview
 * Returns a limited list of published lessons for the marketing landing page.
 * No authentication or subscription required. Only returns title, thumbnail, and stage.
 */
router.get("/preview", asyncHandler(listPublicPreview));
/**
 * GET /lessons/preview/:slug
 * Returns public preview details of a single published lesson (title, description, thumbnail).
 * Used on the landing page "lesson preview" section. No auth needed.
 */
router.get("/preview/:slug", asyncHandler(getPublicPreview));

// ── Authenticated student routes ──────────────────────────────────────────────
// All routes below require a valid student JWT. Access to a specific lesson's
// content/video is gated per-course inside the controllers (course ownership),
// not by a global subscription.
router.use(authenticateStudent());

/**
 * GET /lessons
 * Returns all published lessons matching the student's academic stage.
 * Includes the student's watch progress (percentage, last watched second) for each lesson.
 */
router.get("/", asyncHandler(listForStudent));
/**
 * GET /lessons/:slug
 * Returns full details of a single lesson including video info, chapters, topics, and topics.
 * Also includes the student's current watch progress for this lesson.
 */
router.get("/:slug", asyncHandler(getForStudent));
/**
 * GET /lessons/:slug/video-url
 * Generates a time-limited signed URL for Bunny Stream video playback.
 * The signed URL expires after a short duration to prevent unauthorized sharing.
 */
router.get("/:slug/video-url", asyncHandler(getVideoUrlForStudent));

export default router;
