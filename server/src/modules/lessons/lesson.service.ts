import { Types } from "mongoose";
import { Lesson, type LessonDocument } from "./lesson.model";
import { Course } from "../courses/course.model";
import { ApiError } from "../../shared/utils/ApiError";
import {
  createBunnyVideo,
  uploadVideoFile,
  getBunnyVideoInfo,
  deleteBunnyVideo,
  videoStatusFromBunny,
} from "../bunny/bunny.service";
import { isBunnyConfigured } from "../bunny/bunny.client";
import {
  destroyCloudinaryImageByUrl,
  isCloudinaryConfigured,
  uploadLessonThumbnailImage,
} from "../cloudinary/cloudinary.service";
import { env } from "../../config/env";
import path from "path";
import fs from "fs";
import {
  THUMBNAILS_DIR,
  deleteThumbnailFile,
} from "../../shared/middlewares/upload.middleware";
import type {
  CreateLessonInput,
  UpdateLessonInput,
  ListLessonsQuery,
} from "./lesson.validation";
import { VIDEO_STATUS, type Stage, type VideoStatus } from "../../config/constants";
import { logger } from "../../shared/utils/logger";
import { buildSafeRegex } from "../../shared/utils/regex";

export type BulkLessonAction = "publish" | "unpublish" | "delete";

export interface BulkLessonActionResult {
  processedIds: string[];
  missingIds: string[];
  failedIds: string[];
  publishedNowIds: string[];
}

/** True when another lesson already uses this link (the lesson being edited excluded). */
export async function isLessonSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const filter: Record<string, unknown> = { slug };
  if (exceptId && Types.ObjectId.isValid(exceptId)) filter._id = { $ne: exceptId };
  return !!(await Lesson.exists(filter));
}

/**
 * Creates a new lesson in the database. New lessons start unpublished so
 * the admin can add a video before students can see it.
 * Throws SLUG_TAKEN if another lesson already uses the same slug.
 */
export async function createLesson(
  input: CreateLessonInput,
): Promise<LessonDocument> {
  const existing = await Lesson.findOne({ slug: input.slug });
  if (existing) {
    throw ApiError.conflict("الرابط ده مستخدم قبل كده", "SLUG_TAKEN");
  }

  // A lesson always lives inside a course; its stage is inherited from that
  // course so lesson.stage can never drift from the course it belongs to.
  const course = await Course.findById(input.courseId);
  if (!course) {
    throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");
  }

  return Lesson.create({
    courseId: course._id,
    title: input.title,
    slug: input.slug,
    description: input.description,
    longDescription: input.longDescription,
    stage: course.stage,
    durationMinutes: input.durationMinutes,
    chapters: input.chapters,
    topics: input.topics,
    thumbnail: input.thumbnail ?? null,
    thumbnailGradient: input.thumbnailGradient ?? null,
    order: input.order,
    isPublished: false,
  });
}

/**
 * Uploads a video file to Bunny Stream and links it to a lesson.
 *
 * Flow:
 *   1. Delete old Bunny video if the lesson already had one.
 *   2. Create a new Bunny video entry and upload the file.
 *   3. Try to fetch the video duration (may be 0 if encoding is in progress).
 *   4. Preserve a Cloudinary custom thumbnail; clear legacy Bunny-only poster URLs
 *      because the old Bunny video id is no longer valid.
 *
 * The caller is responsible for deleting the local temp file.
 */
export async function uploadLessonVideo(
  lessonId: string,
  filePath: string,
): Promise<LessonDocument> {
  if (!isBunnyConfigured()) {
    throw ApiError.internal("خدمة الفيديو مش متاحة حالياً، حاول تاني بعدين.");
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound("الدرس غير موجود", "LESSON_NOT_FOUND");

  const previousVideoId = lesson.bunnyVideoId;

  let videoId = "";
  try {
    videoId = await createBunnyVideo(lesson.title);
    await uploadVideoFile(videoId, filePath);
  } catch (err) {
    // Bunny creates the video row before receiving its bytes. Remove a partial
    // replacement, while keeping the existing lesson video untouched.
    if (videoId) await deleteBunnyVideo(videoId);
    throw err;
  }

  // Bunny converts the video for a while after the upload; until it's done
  // the lesson is "processing" (syncLessonVideo checks again later).
  let videoStatus: VideoStatus = VIDEO_STATUS.PROCESSING;
  let durationSeconds = 0;
  try {
    const info = await getBunnyVideoInfo(videoId);
    videoStatus = videoStatusFromBunny(info);
    durationSeconds = info.length || 0;
  } catch (err) {
    logger.warn("Could not fetch Bunny video info immediately", {
      videoId,
      error: err instanceof Error ? err.message : err,
    });
  }

  // Legacy local file thumbnail — remove from disk.
  // A teacher-uploaded thumbnail is independent from Bunny video replacement.
  // Old Bunny Stream poster URL is tied to the deleted video id — drop it.
  if (
    lesson.thumbnail &&
    env.BUNNY_PULL_ZONE &&
    lesson.thumbnail.includes(env.BUNNY_PULL_ZONE)
  ) {
    lesson.thumbnail = null;
  }

  lesson.bunnyVideoId = videoId;
  lesson.videoDurationSeconds = durationSeconds;
  lesson.videoStatus = videoStatus;
  lesson.videoCheckedAt = new Date();
  try {
    await lesson.save();
  } catch (err) {
    // MongoDB still points at the old video, so remove the unreferenced
    // replacement rather than leaving it orphaned in Bunny.
    await deleteBunnyVideo(videoId);
    throw err;
  }

  // Delete the old asset only after MongoDB points to the replacement.
  // deleteBunnyVideo logs but does not throw if Bunny deletion fails.
  if (previousVideoId && previousVideoId !== videoId) {
    await deleteBunnyVideo(previousVideoId);
  }

  return lesson;
}

/** How long a lesson waits between two checks of its video on Bunny. */
const VIDEO_CHECK_EVERY_MS = 10 * 1000;

export interface LessonVideoState {
  status: VideoStatus | null;
  durationSeconds: number;
  /** Bunny's conversion progress (0–100), when Bunny was asked just now. */
  encodeProgress: number | null;
}

/**
 * Brings a lesson's video state up to date from Bunny: whether it's ready to
 * play, and its real duration. A lesson whose video is known to be ready
 * returns at once — no Bunny call, no DB write — so this costs nothing on the
 * normal path. While a video is still converting, checks are spaced out per
 * lesson (one atomic claim per VIDEO_CHECK_EVERY_MS): a crowd of students
 * opening it asks Bunny once, not once each. `force` skips the wait (the
 * teacher pressing publish). If Bunny doesn't answer, the stored state stands.
 */
export async function syncLessonVideo(
  lesson: LessonDocument,
  { force = false }: { force?: boolean } = {},
): Promise<LessonVideoState> {
  const state: LessonVideoState = {
    status: lesson.videoStatus ?? null,
    durationSeconds: lesson.videoDurationSeconds,
    encodeProgress: null,
  };
  const videoId = lesson.bunnyVideoId;
  const known = state.status === VIDEO_STATUS.READY && state.durationSeconds > 0;
  if (!videoId || known || !isBunnyConfigured()) return state;

  const now = new Date();
  const claim = await Lesson.updateOne(
    {
      _id: lesson._id,
      bunnyVideoId: videoId,
      ...(force
        ? {}
        : {
            $or: [
              { videoCheckedAt: null },
              { videoCheckedAt: { $lt: new Date(now.getTime() - VIDEO_CHECK_EVERY_MS) } },
            ],
          }),
    },
    { $set: { videoCheckedAt: now } },
  );
  if (claim.modifiedCount !== 1) return state; // asked a moment ago

  let info;
  try {
    info = await getBunnyVideoInfo(videoId);
  } catch (err) {
    logger.warn("Could not check the lesson's video on Bunny", {
      lessonId: String(lesson._id),
      videoId,
      error: err instanceof Error ? err.message : err,
    });
    return state;
  }

  const status = videoStatusFromBunny(info);
  const durationSeconds = info.length > 0 ? Math.round(info.length) : state.durationSeconds;
  // Only while the lesson still points at this video (not replaced meanwhile).
  await Lesson.updateOne(
    { _id: lesson._id, bunnyVideoId: videoId },
    { $set: { videoStatus: status, videoDurationSeconds: durationSeconds } },
  );
  lesson.videoStatus = status;
  lesson.videoDurationSeconds = durationSeconds;
  return { status, durationSeconds, encodeProgress: info.encodeProgress ?? null };
}

/**
 * Updates the editable metadata fields of a lesson (title, description, stage, etc.).
 * Slug uniqueness is re-checked only when the slug actually changes.
 */
export async function updateLesson(
  lessonId: string,
  input: UpdateLessonInput,
): Promise<LessonDocument> {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound("الدرس غير موجود", "LESSON_NOT_FOUND");

  if (input.slug && input.slug !== lesson.slug) {
    const slugTaken = await Lesson.findOne({
      slug: input.slug,
      _id: { $ne: lesson._id },
    });
    if (slugTaken) {
      throw ApiError.conflict("الرابط ده مستخدم قبل كده", "SLUG_TAKEN");
    }
  }

  // Moving the lesson to another course re-inherits that course's stage.
  let derivedStage = lesson.stage;
  if (input.courseId && String(input.courseId) !== String(lesson.courseId)) {
    const course = await Course.findById(input.courseId);
    if (!course) {
      throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");
    }
    derivedStage = course.stage;
  }

  // stage is always derived, never taken from the client payload directly.
  const { stage: _ignoredStage, ...rest } = input;
  Object.assign(lesson, rest);
  lesson.stage = derivedStage;
  await lesson.save();
  return lesson;
}

/**
 * Toggles the published state of a lesson.
 * A lesson cannot be published if it has no Bunny video attached,
 * since a published lesson with no video would give students an error.
 */
export interface SetLessonPublishedResult {
  lesson: LessonDocument;
  /** True only for a draft -> published transition, never for a re-publish. */
  publishedNow: boolean;
}

export async function setLessonPublished(
  lessonId: string,
  isPublished: boolean,
): Promise<SetLessonPublishedResult> {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound("الدرس غير موجود", "LESSON_NOT_FOUND");

  const publishedNow = isPublished && !lesson.isPublished;

  if (isPublished && !lesson.bunnyVideoId) {
    throw ApiError.badRequest(
      "مش ممكن تنشر درس مفيش له فيديو",
      "NO_VIDEO_UPLOADED",
    );
  }

  // Students get the lesson the moment it's published — so not before its
  // video plays (until then they'd see a black screen).
  if (publishedNow) {
    const { status } = await syncLessonVideo(lesson, { force: true });
    if (status === VIDEO_STATUS.FAILED) {
      throw ApiError.conflict(
        "الفيديو ده فيه مشكلة ومش هيشتغل للطلاب — ارفعه تاني من صفحة الدرس.",
        "VIDEO_FAILED",
      );
    }
    if (status === VIDEO_STATUS.PROCESSING) {
      throw ApiError.conflict(
        "الفيديو لسه بيتجهز — هتقدر تنشر الدرس أول ما يخلص.",
        "VIDEO_PROCESSING",
      );
    }
    if (status !== VIDEO_STATUS.READY) {
      throw ApiError.conflict(
        "مقدرناش نتأكد إن الفيديو جاهز — حاول تاني كمان شوية.",
        "VIDEO_UNCHECKED",
      );
    }
  }

  lesson.isPublished = isPublished;
  // Record the FIRST publish moment only — used to compute "days since release"
  // for the parent-notification workflow. Re-publishing after an unpublish does
  // NOT reset it, so the "late" window stays anchored to when students could
  // actually first see the lesson.
  if (isPublished && !lesson.publishedAt) {
    lesson.publishedAt = new Date();
  }
  await lesson.save();
  return { lesson, publishedNow };
}

/**
 * Permanently deletes a lesson and cleans up all associated assets:
 *   - Removes the video from Bunny Stream (if one was uploaded).
 *   - Deletes the Cloudinary thumbnail asset when applicable.
 *   - Deletes the lesson document from MongoDB.
 */
export async function deleteLesson(lessonId: string): Promise<void> {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound("الدرس غير موجود", "LESSON_NOT_FOUND");

  if (lesson.bunnyVideoId) {
    await deleteBunnyVideo(lesson.bunnyVideoId);
  }
  if (lesson.thumbnail && lesson.thumbnail.startsWith("/uploads/")) {
    deleteThumbnailFile(lesson.thumbnail);
  } else {
    await destroyCloudinaryImageByUrl(lesson.thumbnail ?? undefined);
  }
  await lesson.deleteOne();
}

/** Runs selected lesson actions without bypassing video/media safeguards. */
export async function applyBulkLessonAction(
  lessonIds: string[],
  action: BulkLessonAction,
): Promise<BulkLessonActionResult> {
  const existing = await Lesson.find({
    _id: { $in: lessonIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("_id")
    .lean();
  const existingIds = new Set(existing.map((lesson) => String(lesson._id)));
  const missingIds = lessonIds.filter((id) => !existingIds.has(id));
  const idsToProcess = lessonIds.filter((id) => existingIds.has(id));
  const processedIds: string[] = [];
  const failedIds: string[] = [];
  const publishedNowIds: string[] = [];

  const batchSize = 5;
  for (let start = 0; start < idsToProcess.length; start += batchSize) {
    const batch = idsToProcess.slice(start, start + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (lessonId) => {
        if (action === "delete") {
          await deleteLesson(lessonId);
          return false;
        }
        const { publishedNow } = await setLessonPublished(
          lessonId,
          action === "publish",
        );
        return publishedNow;
      }),
    );
    settled.forEach((result, index) => {
      if (result.status === "rejected") {
        failedIds.push(batch[index]);
        return;
      }
      processedIds.push(batch[index]);
      if (result.value) publishedNowIds.push(batch[index]);
    });
  }

  return { processedIds, missingIds, failedIds, publishedNowIds };
}

export async function setLessonThumbnailFromUpload(
  lessonId: string,
  filename: string,
): Promise<LessonDocument> {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound("الدرس غير موجود", "LESSON_NOT_FOUND");

  const localFilePath = path.join(THUMBNAILS_DIR, filename);

  if (!isCloudinaryConfigured()) {
    fs.promises.unlink(localFilePath).catch(() => undefined);
    throw new ApiError(
      500,
      "خدمة رفع الصور مش متاحة حالياً، حاول تاني بعدين.",
      {
        code: "CLOUDINARY_NOT_CONFIGURED",
        isOperational: true,
      },
    );
  }

  if (lesson.thumbnail && lesson.thumbnail.startsWith("/uploads/")) {
    deleteThumbnailFile(lesson.thumbnail);
  }

  try {
    const { secure_url } = await uploadLessonThumbnailImage(
      lessonId,
      localFilePath,
    );
    lesson.thumbnail = secure_url;
    await lesson.save();
    return lesson;
  } catch (err) {
    logger.error("Failed to upload thumbnail to Cloudinary", {
      lessonId,
      error: err instanceof Error ? err.message : err,
    });
    throw ApiError.internal("فشل رفع الصورة، حاول تاني.");
  } finally {
    fs.promises.unlink(localFilePath).catch(() => undefined);
  }
}

/**
 * Clears the lesson thumbnail: removes legacy disk file or deletes the asset on Cloudinary.
 * The UI falls back to the CSS gradient placeholder when thumbnail is null.
 */
export async function clearLessonThumbnail(
  lessonId: string,
): Promise<LessonDocument> {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound("الدرس غير موجود", "LESSON_NOT_FOUND");

  if (lesson.thumbnail && lesson.thumbnail.startsWith("/uploads/")) {
    deleteThumbnailFile(lesson.thumbnail);
  } else {
    await destroyCloudinaryImageByUrl(lesson.thumbnail ?? undefined);
  }

  lesson.thumbnail = null;
  await lesson.save();
  return lesson;
}

/**
 * Returns a paginated, filterable list of lessons for the admin panel.
 * Supports filtering by stage, publish status, and free-text search
 * across title, slug, and description.
 */
export async function listLessonsForAdmin(query: ListLessonsQuery) {
  const filter: Record<string, unknown> = {};
  if (query.courseId) filter.courseId = query.courseId;
  if (query.stage) filter.stage = query.stage;
  if (query.isPublished !== undefined) filter.isPublished = query.isPublished;
  if (query.search) {
    const safe = buildSafeRegex(query.search);
    filter.$or = [{ title: safe }, { slug: safe }, { description: safe }];
  }

  const [items, total] = await Promise.all([
    Lesson.find(filter)
      .sort({ stage: 1, order: 1, createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Lesson.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  };
}

/** Published lessons across a set of course ids (a student's accessible lessons). */
export async function listPublishedLessonsForCourses(
  courseIds: string[],
): Promise<LessonDocument[]> {
  if (courseIds.length === 0) return [];
  return Lesson.find({ courseId: { $in: courseIds }, isPublished: true }).sort({
    order: 1,
    createdAt: -1,
  });
}

/** Returns all published lessons for a specific stage (1, 2, or 3). */
export async function listPublishedLessonsForStage(
  stage: Stage,
): Promise<LessonDocument[]> {
  return Lesson.find({ stage, isPublished: true }).sort({
    order: 1,
    createdAt: -1,
  });
}

/** Returns all published lessons across all stages, used for the public preview page. */
export async function listAllPublishedLessons(): Promise<LessonDocument[]> {
  return Lesson.find({ isPublished: true }).sort({
    stage: 1,
    order: 1,
    createdAt: -1,
  });
}

/**
 * Finds a published lesson by slug AND stage.
 * Returns null if not found or if the lesson belongs to a different stage.
 * Used to enforce stage-based access control for students.
 */
export async function getPublishedLessonBySlugForStage(
  slug: string,
  stage: Stage,
): Promise<LessonDocument | null> {
  return Lesson.findOne({ slug, stage, isPublished: true });
}

/**
 * Finds a published lesson by slug without checking the stage.
 * Used to distinguish between "lesson not found" and "lesson is for a different stage".
 */
export async function getPublishedLessonBySlug(
  slug: string,
): Promise<LessonDocument | null> {
  return Lesson.findOne({ slug, isPublished: true });
}

/** Fetches any lesson by ID regardless of publish status. Used by admin routes. */
export async function getLessonById(
  id: string,
): Promise<LessonDocument | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return Lesson.findById(id);
}
