import express, { Router, type Request, type Response, type NextFunction } from "express";
import { update, get, listMine } from "./progress.controller";
import { updateProgressSchema } from "./progress.validation";
import { validate } from "../../shared/middlewares/validate.middleware";
import {
  authenticateStudent,
  authenticateStudentLeavingLesson,
} from "../../shared/middlewares/auth.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { progressLimiter } from "../../shared/middlewares/rateLimit.middleware";
import { ApiError } from "../../shared/utils/ApiError";
import { env } from "../../config/env";

const router = Router();
// Per-lesson course-ownership is enforced inside the progress service.

const CLIENT_ORIGIN = new URL(env.CLIENT_URL).origin;

/**
 * The player sends the save as text/plain: a "simple" request the browser
 * sends straight away, with no CORS preflight before it — one request instead
 * of two, while the page may be closing. Simple requests skip the preflight
 * that normally keeps other sites out, so the Origin (which browsers attach to
 * every POST) is checked here instead. JSON bodies still go through the
 * preflight as usual.
 */
function fromOurSiteIfPlainText(req: Request, _res: Response, next: NextFunction) {
  if (!req.is("text/plain") || req.get("origin") === CLIENT_ORIGIN) return next();
  next(ApiError.forbidden("الطلب ده مش مسموح.", "BAD_ORIGIN"));
}
const plainTextJson = express.json({ type: "text/plain", limit: "1kb" });

/**
 * GET /progress
 * Returns the current student's watch progress across all lessons.
 * Each item includes: lastWatchedSecond, watchedPercentage, isCompleted, lastWatchedAt.
 */
router.get("/", authenticateStudent(), asyncHandler(listMine));
/**
 * GET /progress/:lessonId
 * Returns the student's detailed progress for a specific lesson.
 * Includes: lastWatchedSecond, watchedPercentage, isCompleted, completedAt, firstWatchedAt.
 */
router.get("/:lessonId", authenticateStudent(), asyncHandler(get));
/**
 * POST /progress/:lessonId
 * Sent once each time the student leaves the video (another page, the tab
 * hidden, a refresh, the browser closed) — never while it plays.
 * Updates the student's lastWatchedSecond and calculates watchedPercentage.
 * Marks the lesson as completed when watchedPercentage reaches LESSON_COMPLETION_THRESHOLD.
 */
router.post(
  "/:lessonId",
  progressLimiter,
  fromOurSiteIfPlainText,
  plainTextJson,
  authenticateStudentLeavingLesson(),
  validate(updateProgressSchema),
  asyncHandler(update),
);

export default router;
