import { Router } from "express";
import {
  adminCreate,
  adminList,
  adminSlugAvailable,
  adminBulkAction,
  adminGet,
  adminVideoStatus,
  adminUpdate,
  adminTogglePublish,
  adminDelete,
  adminUploadVideo,
  adminUploadThumbnail,
  adminClearThumbnail,
} from "./lesson.controller";
import {
  createLessonSchema,
  updateLessonSchema,
  togglePublishSchema,
  listLessonsQuerySchema,
  bulkLessonActionSchema,
} from "./lesson.validation";
import { validate } from "../../shared/middlewares/validate.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  videoUpload,
  discardAbortedUpload,
  discardUploadOnError,
  thumbnailUpload,
  verifyUploadedImage,
  verifyUploadedVideo,
} from "../../shared/middlewares/upload.middleware";

const router = Router();

// ── Lesson CRUD ────────────────────────────────────────────────────────────

/**
 * GET /admin/lessons
 * Returns a paginated list of all lessons (draft + published) for the admin dashboard.
 * Supports filtering by stage, publish status, and search query.
 */
router.get(
  "/",
  validate(listLessonsQuerySchema, "query"),
  asyncHandler(adminList),
);

/**
 * POST /admin/lessons
 * Creates a new lesson (metadata only — video is uploaded in a follow-up request).
 * Sets isPublished=false by default. Publishing is rejected until a Bunny video ID exists.
 * Slug must be unique across all lessons.
 */
router.post("/", validate(createLessonSchema), asyncHandler(adminCreate));
// Before "/:id" so "slug-available" isn't read as an id.
router.get("/slug-available", asyncHandler(adminSlugAvailable));
router.post(
  "/bulk-action",
  validate(bulkLessonActionSchema),
  asyncHandler(adminBulkAction),
);

/**
 * GET /admin/lessons/:id
 * Returns full details of a single lesson including Bunny video status and thumbnail.
 * Used by the admin edit page to pre-fill the form.
 */
router.get("/:id", asyncHandler(adminGet));

/**
 * GET /admin/lessons/:id/video-status
 * Whether Bunny has finished converting the video (and its duration). The edit
 * page asks every few seconds while it is still converting.
 */
router.get("/:id/video-status", asyncHandler(adminVideoStatus));

/**
 * PATCH /admin/lessons/:id
 * Updates lesson metadata (title, description, stage, order, etc.).
 * Does NOT modify the video or thumbnail — use the dedicated upload routes for that.
 */
router.patch("/:id", validate(updateLessonSchema), asyncHandler(adminUpdate));

// ── Publish toggle ──────────────────────────────────────────────────────────

/**
 * PATCH /admin/lessons/:id/publish
 * Toggles the isPublished status of a lesson (publish / unpublish).
 * Rejects with NO_VIDEO_UPLOADED if the lesson has no Bunny video attached.
 * A lesson must be published before students can see it.
 */
router.patch(
  "/:id/publish",
  validate(togglePublishSchema),
  asyncHandler(adminTogglePublish),
);

/**
 * DELETE /admin/lessons/:id
 * Permanently deletes a lesson and its associated Bunny video (if any).
 * Also cleans up the thumbnail file if stored locally.
 */
router.delete("/:id", asyncHandler(adminDelete));

// ── Media uploads ───────────────────────────────────────────────────────────
// Each upload route runs two middlewares before the controller:
//   1. multer — saves the file to disk and sets req.file
//   2. verifyUploaded* — reads magic bytes to confirm the real file type

/**
 * POST /admin/lessons/:id/video
 * Uploads a video file to Bunny Stream and links it to the lesson.
 * Automatically deletes the old Bunny video if one existed.
 * Also fetches and stores the video duration for progress tracking.
 */
router.post(
  "/:id/video",
  discardAbortedUpload,
  videoUpload.single("video"),
  verifyUploadedVideo,
  asyncHandler(adminUploadVideo),
  discardUploadOnError,
);

/**
 * POST /admin/lessons/:id/thumbnail
 * Uploads the lesson image to Cloudinary (Bunny is used for video only).
 */
router.post(
  "/:id/thumbnail",
  thumbnailUpload.single("thumbnail"),
  verifyUploadedImage,
  asyncHandler(adminUploadThumbnail),
);

/**
 * DELETE /admin/lessons/:id/thumbnail
 * Removes the stored thumbnail (deletes asset on Cloudinary when applicable).
 */
router.delete("/:id/thumbnail", asyncHandler(adminClearThumbnail));

export default router;
