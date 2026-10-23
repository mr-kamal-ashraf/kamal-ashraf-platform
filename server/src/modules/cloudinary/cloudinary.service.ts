import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env";
import { logger } from "../../shared/utils/logger";

export function isCloudinaryConfigured(): boolean {
  return !!(
    env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET
  );
}

function configure(): void {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** True when URL is served from this project's Cloudinary account. */
export function isCloudinaryLessonThumbnailUrl(url: string): boolean {
  if (!env.CLOUDINARY_CLOUD_NAME) return false;
  try {
    const u = new URL(url);
    if (u.hostname !== "res.cloudinary.com") return false;
    return u.pathname.includes(`/${env.CLOUDINARY_CLOUD_NAME}/image/`);
  } catch {
    return false;
  }
}

/**
 * Extract Cloudinary public_id from a secure URL (image/upload/.../id.ext).
 */
export function publicIdFromCloudinaryUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf("/upload/");
    if (idx === -1) return null;
    let tail = u.pathname.slice(idx + "/upload/".length);
    tail = tail.replace(/^v\d+\//, "");
    tail = tail.replace(/\.[^/.]+$/i, "");
    return tail || null;
  } catch {
    return null;
  }
}

/**
 * Upload a local image file as this lesson's thumbnail (overwrites same public_id).
 */
export async function uploadLessonThumbnailImage(
  lessonId: string,
  filePath: string,
): Promise<{ secure_url: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured");
  }
  configure();
  const folder = env.CLOUDINARY_THUMBNAIL_FOLDER.replace(/^\/+|\/+$/g, "");
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    public_id: lessonId,
    overwrite: true,
    resource_type: "image",
  });
  if (!result.secure_url) {
    throw new Error("Cloudinary did not return secure_url");
  }
  return { secure_url: result.secure_url };
}

/**
 * Upload a local image file as this course's cover thumbnail. Uses the same
 * thumbnail folder as lessons but a "course_" public_id prefix so course and
 * lesson thumbnails never collide. Overwrites the same public_id on re-upload.
 */
export async function uploadCourseThumbnailImage(
  courseId: string,
  filePath: string,
): Promise<{ secure_url: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured");
  }
  configure();
  const folder = env.CLOUDINARY_THUMBNAIL_FOLDER.replace(/^\/+|\/+$/g, "");
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    public_id: `course_${courseId}`,
    overwrite: true,
    resource_type: "image",
  });
  if (!result.secure_url) {
    throw new Error("Cloudinary did not return secure_url");
  }
  return { secure_url: result.secure_url };
}

/**
 * Upload a platform branding image (logo, hero portrait, favicon) from the
 * admin "appearance" settings. Stored next to the thumbnails under a "site_"
 * public_id; a timestamp suffix gives every upload a fresh URL so browsers
 * and the frontend cache never keep showing the previous image.
 */
export async function uploadSiteImage(
  name: string,
  filePath: string,
): Promise<{ secure_url: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured");
  }
  configure();
  const folder = env.CLOUDINARY_THUMBNAIL_FOLDER.replace(/^\/+|\/+$/g, "");
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    public_id: `site_${name}_${Date.now()}`,
    overwrite: false,
    resource_type: "image",
  });
  if (!result.secure_url) {
    throw new Error("Cloudinary did not return secure_url");
  }
  return { secure_url: result.secure_url };
}

/** Best-effort delete of a previous thumbnail asset on Cloudinary. */
export async function destroyCloudinaryImageByUrl(
  url: string | null | undefined,
): Promise<void> {
  if (!url || !isCloudinaryConfigured()) return;
  if (!isCloudinaryLessonThumbnailUrl(url)) return;
  const publicId = publicIdFromCloudinaryUrl(url);
  if (!publicId) return;
  configure();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    logger.warn("Cloudinary destroy failed (non-fatal)", {
      publicId,
      error: err instanceof Error ? err.message : err,
    });
  }
}

/** True when URL is a curriculum PDF served from this project's Cloudinary account. */
export function isCloudinaryCurriculumUrl(url: string): boolean {
  if (!env.CLOUDINARY_CLOUD_NAME) return false;
  try {
    const u = new URL(url);
    if (u.hostname !== "res.cloudinary.com") return false;
    return u.pathname.includes(`/${env.CLOUDINARY_CLOUD_NAME}/raw/`);
  } catch {
    return false;
  }
}

/**
 * Extract a RAW-resource public_id from a secure URL (raw/upload/.../id.ext).
 *
 * Unlike images/video, Cloudinary's "raw" resource type folds the original
 * file extension INTO the public_id itself (there's no separate "format"),
 * so — unlike publicIdFromCloudinaryUrl() above — this deliberately keeps
 * the extension. Passing the extension-stripped id to destroy() would silently
 * no-op and leak storage.
 */
function rawPublicIdFromCloudinaryUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf("/upload/");
    if (idx === -1) return null;
    let tail = u.pathname.slice(idx + "/upload/".length);
    tail = tail.replace(/^v\d+\//, "");
    return tail || null;
  } catch {
    return null;
  }
}

/**
 * Upload a local PDF file as a teacher's curriculum book.
 *
 * public_id is deterministic (teacherId_bookId) and overwrite:true, so
 * re-uploading the same book_id replaces the previous file in place —
 * mirroring uploadLessonThumbnailImage()'s behavior for images.
 */
export async function uploadCurriculumPdf(
  teacherId: string,
  bookId: string,
  filePath: string,
): Promise<{ secure_url: string }> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured");
  }
  configure();
  const folder = env.CLOUDINARY_CURRICULUM_FOLDER.replace(/^\/+|\/+$/g, "");
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    public_id: `${teacherId}_${bookId}`,
    overwrite: true,
    resource_type: "raw",
  });
  if (!result.secure_url) {
    throw new Error("Cloudinary did not return secure_url");
  }
  return { secure_url: result.secure_url };
}

/** Best-effort delete of a previous curriculum PDF asset on Cloudinary. */
export async function destroyCloudinaryCurriculumByUrl(
  url: string | null | undefined,
): Promise<void> {
  if (!url || !isCloudinaryConfigured()) return;
  if (!isCloudinaryCurriculumUrl(url)) return;
  const publicId = rawPublicIdFromCloudinaryUrl(url);
  if (!publicId) return;
  configure();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (err) {
    logger.warn("Cloudinary destroy failed (non-fatal)", {
      publicId,
      error: err instanceof Error ? err.message : err,
    });
  }
}
