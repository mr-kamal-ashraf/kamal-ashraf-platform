import { Router } from "express";
import {
  listPublicPreview,
  listForStudent,
  getForStudent,
} from "./course.controller";
import { authenticateStudent } from "../../shared/middlewares/auth.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = Router();

// ── Public routes (no auth required) ──────────────────────────────────────────
/** GET /courses/preview — published courses for the marketing landing page. */
router.get("/preview", authenticateStudent(false), asyncHandler(listPublicPreview));

// ── Student list (requires auth — needs the student's stage) ───────────────────
/** GET /courses — published courses for the student's own stage (+owned flag). */
router.get("/", authenticateStudent(), asyncHandler(listForStudent));

// ── Course detail (PUBLIC — guests can view; login is only needed to buy) ──────
// Optional auth: if a valid student cookie is present we add the `owned` flag,
// otherwise the detail is still returned for anyone to browse.
router.get("/:slug", authenticateStudent(false), asyncHandler(getForStudent));

export default router;
