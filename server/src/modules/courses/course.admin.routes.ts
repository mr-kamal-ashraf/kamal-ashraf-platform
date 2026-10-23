import { Router } from "express";
import {
  adminCreate,
  adminList,
  adminSlugAvailable,
  adminBulkAction,
  adminGet,
  adminUpdate,
  adminTogglePublish,
  adminDelete,
  adminUploadThumbnail,
  adminClearThumbnail,
} from "./course.controller";
import {
  createCourseSchema,
  updateCourseSchema,
  togglePublishSchema,
  listCoursesQuerySchema,
  bulkCourseActionSchema,
} from "./course.validation";
import { validate } from "../../shared/middlewares/validate.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  thumbnailUpload,
  verifyUploadedImage,
} from "../../shared/middlewares/upload.middleware";

const router = Router();

// ── Course CRUD ───────────────────────────────────────────────────────────────
router.get(
  "/",
  validate(listCoursesQuerySchema, "query"),
  asyncHandler(adminList),
);
router.post("/", validate(createCourseSchema), asyncHandler(adminCreate));
// Before "/:id" so "slug-available" isn't read as an id.
router.get("/slug-available", asyncHandler(adminSlugAvailable));
router.post(
  "/bulk-action",
  validate(bulkCourseActionSchema),
  asyncHandler(adminBulkAction),
);
router.get("/:id", asyncHandler(adminGet));
router.patch("/:id", validate(updateCourseSchema), asyncHandler(adminUpdate));

// ── Publish toggle ──────────────────────────────────────────────────────────
router.patch(
  "/:id/publish",
  validate(togglePublishSchema),
  asyncHandler(adminTogglePublish),
);

router.delete("/:id", asyncHandler(adminDelete));

// ── Cover image ─────────────────────────────────────────────────────────────
router.post(
  "/:id/thumbnail",
  thumbnailUpload.single("thumbnail"),
  verifyUploadedImage,
  asyncHandler(adminUploadThumbnail),
);
router.delete("/:id/thumbnail", asyncHandler(adminClearThumbnail));

export default router;
