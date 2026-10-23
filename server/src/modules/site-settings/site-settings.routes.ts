import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { validate } from "../../shared/middlewares/validate.middleware";
import {
  thumbnailUpload,
  verifyUploadedImage,
} from "../../shared/middlewares/upload.middleware";
import {
  adminClearAsset,
  adminClearFavicon,
  adminGet,
  adminResetSection,
  adminUpdateSection,
  adminUploadAsset,
  adminUploadFavicon,
  getPublic,
} from "./site-settings.controller";
import { assetParamsSchema, sectionParamsSchema } from "./site-settings.validation";

/**
 * GET /settings — the website's appearance & content settings (public).
 * Mounted without auth: the frontend reads it on every page render.
 */
export const publicSettingsRoutes = Router();
publicSettingsRoutes.get("/", asyncHandler(getPublic));

/**
 * /admin/settings — the teacher's appearance & content editor.
 * Mounted under the admin router, so every route here is admin-authenticated.
 */
export const adminSettingsRoutes = Router();

adminSettingsRoutes.get("/", asyncHandler(adminGet));

// Images — declared before /:section so "assets" / "favicon" never match it.
adminSettingsRoutes.post(
  "/favicon",
  thumbnailUpload.single("image"),
  verifyUploadedImage,
  asyncHandler(adminUploadFavicon)
);
adminSettingsRoutes.delete("/favicon", asyncHandler(adminClearFavicon));

adminSettingsRoutes.post(
  "/assets/:palette/:slot",
  validate(assetParamsSchema, "params"),
  thumbnailUpload.single("image"),
  verifyUploadedImage,
  asyncHandler(adminUploadAsset)
);
adminSettingsRoutes.delete(
  "/assets/:palette/:slot",
  validate(assetParamsSchema, "params"),
  asyncHandler(adminClearAsset)
);

// Content sections (theme, hero, whyUs, faq, contact, announcement, welcome).
adminSettingsRoutes.put(
  "/:section",
  validate(sectionParamsSchema, "params"),
  asyncHandler(adminUpdateSection)
);
adminSettingsRoutes.delete(
  "/:section",
  validate(sectionParamsSchema, "params"),
  asyncHandler(adminResetSection)
);
