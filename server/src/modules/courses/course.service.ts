import { Types } from "mongoose";
import { Course, type CourseDocument } from "./course.model";
import { Lesson } from "../lessons/lesson.model";
import { ApiError } from "../../shared/utils/ApiError";
import {
  isCloudinaryConfigured,
  uploadCourseThumbnailImage,
  destroyCloudinaryImageByUrl,
} from "../cloudinary/cloudinary.service";
import {
  THUMBNAILS_DIR,
  deleteThumbnailFile,
} from "../../shared/middlewares/upload.middleware";
import { Enrollment } from "../enrollments/enrollment.model";
import { LessonProgress } from "../progress/progress.model";
import { deleteLesson } from "../lessons/lesson.service";
import path from "path";
import fs from "fs";
import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesQuery,
} from "./course.validation";
import type { Stage } from "../../config/constants";
import { logger } from "../../shared/utils/logger";
import { buildSafeRegex } from "../../shared/utils/regex";
import {
  firstFreeSlug,
  isDuplicateSlugError,
  slugFamily,
  slugFromTitle,
  withRandomTail,
} from "../../shared/utils/slug";
import { withoutUndefined } from "../../shared/utils/object";

export type BulkCourseAction = "publish" | "unpublish" | "delete";

export interface BulkCourseActionResult {
  processedIds: string[];
  missingIds: string[];
  failedIds: string[];
}

/** True when another course already uses this link (the course being edited excluded). */
export async function isCourseSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const filter: Record<string, unknown> = { slug };
  if (exceptId && Types.ObjectId.isValid(exceptId)) filter._id = { $ne: exceptId };
  return !!(await Course.exists(filter));
}

/** The title's link, numbered when another course already has it. */
async function freeCourseSlug(title: string): Promise<string> {
  const base = slugFromTitle(title, "course");
  const taken = await Course.distinct("slug", { slug: slugFamily(base) });
  return firstFreeSlug(base, new Set(taken));
}

/**
 * Creates a new course. New courses start unpublished. Without a link, one is
 * made from the title (the teacher never has to type one).
 */
export async function createCourse(
  input: CreateCourseInput,
): Promise<CourseDocument> {
  if (input.slug && (await Course.exists({ slug: input.slug }))) {
    throw ApiError.conflict("الرابط ده مستخدم قبل كده", "SLUG_TAKEN");
  }

  const slug = input.slug ?? (await freeCourseSlug(input.title));
  const fields = {
    title: input.title,
    slug,
    description: input.description,
    longDescription: input.longDescription,
    stage: input.stage,
    price: input.price,
    thumbnail: input.thumbnail ?? null,
    thumbnailGradient: input.thumbnailGradient ?? null,
    order: input.order,
    isPublished: false,
  };
  try {
    return await Course.create(fields);
  } catch (err) {
    if (!isDuplicateSlugError(err)) throw err;
    if (input.slug) throw ApiError.conflict("الرابط ده مستخدم قبل كده", "SLUG_TAKEN");
    // Another course took the same free link at the same moment.
    return Course.create({ ...fields, slug: withRandomTail(slug) });
  }
}

/**
 * Updates course metadata. Slug uniqueness re-checked only when it changes.
 * When the stage changes, all lessons under the course are re-synced to the
 * new stage so lesson.stage never drifts from its course.
 */
export async function updateCourse(
  courseId: string,
  input: UpdateCourseInput,
): Promise<CourseDocument> {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");

  if (input.slug && input.slug !== course.slug) {
    const taken = await Course.findOne({
      slug: input.slug,
      _id: { $ne: course._id },
    });
    if (taken) {
      throw ApiError.conflict("الرابط ده مستخدم قبل كده", "SLUG_TAKEN");
    }
  }

  const stageChanged = input.stage !== undefined && input.stage !== course.stage;

  // A field sent empty on purpose (an empty link) leaves the stored one alone.
  Object.assign(course, withoutUndefined(input));
  await course.save();

  if (stageChanged) {
    await Lesson.updateMany(
      { courseId: course._id },
      { $set: { stage: course.stage } },
    );
  }

  return course;
}

/**
 * Publishes/unpublishes a course. A course cannot be published unless it has at
 * least one published lesson — otherwise students would open an empty course.
 */
export async function setCoursePublished(
  courseId: string,
  isPublished: boolean,
): Promise<CourseDocument> {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");

  if (isPublished) {
    const publishedLessons = await Lesson.countDocuments({
      courseId: course._id,
      isPublished: true,
    });
    if (publishedLessons === 0) {
      throw ApiError.badRequest(
        "مش ممكن تنشر كورس مفيهوش أي درس منشور",
        "NO_PUBLISHED_LESSONS",
      );
    }
  }

  course.isPublished = isPublished;
  await course.save();
  return course;
}

/**
 * Deletes a course AND everything under it, in one cascade:
 *   - every lesson in the course (its Bunny video + thumbnail asset + the
 *     lesson document), via the shared deleteLesson so media cleanup lives in
 *     one place;
 *   - all watch-progress rows for those lessons;
 *   - all ownership records (enrollments) for the course — enrolled students
 *     lose access, since the course no longer exists;
 *   - the course's own cover image, then the course document.
 *
 * Payment records are intentionally KEPT as a financial history (same policy as
 * deleting a student). Irreversible — the admin UI gates it behind a
 * confirmation popup.
 */
export async function deleteCourse(courseId: string): Promise<void> {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");

  // 1) Delete every lesson (media + document) and its watch progress.
  const lessons = await Lesson.find({ courseId: course._id })
    .select("_id")
    .lean();
  const lessonIds = lessons.map((l) => l._id);
  for (const id of lessonIds) {
    await deleteLesson(String(id));
  }
  if (lessonIds.length > 0) {
    await LessonProgress.deleteMany({ lessonId: { $in: lessonIds } });
  }

  // 2) Remove ownership records for this course (payments are kept).
  await Enrollment.deleteMany({ courseId: course._id });

  // 3) Course cover image, then the course itself.
  if (course.thumbnail && course.thumbnail.startsWith("/uploads/")) {
    deleteThumbnailFile(course.thumbnail);
  } else {
    await destroyCloudinaryImageByUrl(course.thumbnail ?? undefined);
  }

  await course.deleteOne();
}

/**
 * Runs an action on selected courses in small batches. Reusing the individual
 * service methods keeps their media cleanup and publish guards intact.
 */
export async function applyBulkCourseAction(
  courseIds: string[],
  action: BulkCourseAction,
): Promise<BulkCourseActionResult> {
  const existing = await Course.find({
    _id: { $in: courseIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("_id")
    .lean();
  const existingIds = new Set(existing.map((course) => String(course._id)));
  const missingIds = courseIds.filter((id) => !existingIds.has(id));
  const idsToProcess = courseIds.filter((id) => existingIds.has(id));
  const processedIds: string[] = [];
  const failedIds: string[] = [];

  const batchSize = 5;
  for (let start = 0; start < idsToProcess.length; start += batchSize) {
    const batch = idsToProcess.slice(start, start + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (courseId) => {
        if (action === "delete") return deleteCourse(courseId);
        return setCoursePublished(courseId, action === "publish");
      }),
    );
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") processedIds.push(batch[index]);
      else failedIds.push(batch[index]);
    });
  }

  return { processedIds, missingIds, failedIds };
}

/** Uploads a course cover image to Cloudinary. */
export async function setCourseThumbnailFromUpload(
  courseId: string,
  filename: string,
): Promise<CourseDocument> {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");

  const localFilePath = path.join(THUMBNAILS_DIR, filename);

  if (!isCloudinaryConfigured()) {
    fs.promises.unlink(localFilePath).catch(() => undefined);
    throw new ApiError(
      500,
      "خدمة رفع الصور مش متاحة حالياً، حاول تاني بعدين.",
      { code: "CLOUDINARY_NOT_CONFIGURED", isOperational: true },
    );
  }

  if (course.thumbnail && course.thumbnail.startsWith("/uploads/")) {
    deleteThumbnailFile(course.thumbnail);
  }

  try {
    const { secure_url } = await uploadCourseThumbnailImage(
      courseId,
      localFilePath,
    );
    course.thumbnail = secure_url;
    await course.save();
    return course;
  } catch (err) {
    logger.error("Failed to upload course thumbnail to Cloudinary", {
      courseId,
      error: err instanceof Error ? err.message : err,
    });
    throw ApiError.internal("فشل رفع الصورة، حاول تاني.");
  } finally {
    fs.promises.unlink(localFilePath).catch(() => undefined);
  }
}

/** Clears the course thumbnail. */
export async function clearCourseThumbnail(
  courseId: string,
): Promise<CourseDocument> {
  const course = await Course.findById(courseId);
  if (!course) throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");

  if (course.thumbnail && course.thumbnail.startsWith("/uploads/")) {
    deleteThumbnailFile(course.thumbnail);
  } else {
    await destroyCloudinaryImageByUrl(course.thumbnail ?? undefined);
  }

  course.thumbnail = null;
  await course.save();
  return course;
}

/** Attaches a lessonsCount to a plain course object. */
async function withLessonCounts<T extends { _id: Types.ObjectId }>(
  courses: T[],
): Promise<(T & { lessonsCount: number; publishedLessonsCount: number })[]> {
  if (courses.length === 0) return [];
  const ids = courses.map((c) => c._id);
  const counts = await Lesson.aggregate<{
    _id: Types.ObjectId;
    total: number;
    published: number;
  }>([
    { $match: { courseId: { $in: ids } } },
    {
      $group: {
        _id: "$courseId",
        total: { $sum: 1 },
        published: { $sum: { $cond: ["$isPublished", 1, 0] } },
      },
    },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c]));
  return courses.map((c) => {
    const row = byId.get(String(c._id));
    return {
      ...c,
      lessonsCount: row?.total ?? 0,
      publishedLessonsCount: row?.published ?? 0,
    };
  });
}

/** Paginated, filterable list of courses for the admin panel. */
export async function listCoursesForAdmin(query: ListCoursesQuery) {
  const filter: Record<string, unknown> = {};
  if (query.stage) filter.stage = query.stage;
  if (query.isPublished !== undefined) filter.isPublished = query.isPublished;
  if (query.search) {
    const safe = buildSafeRegex(query.search);
    filter.$or = [{ title: safe }, { slug: safe }, { description: safe }];
  }

  const [rawItems, total] = await Promise.all([
    Course.find(filter)
      .sort({ stage: 1, order: 1, createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Course.countDocuments(filter),
  ]);

  const items = await withLessonCounts(rawItems);

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  };
}

/** Published courses for a specific stage (student browse), with lesson counts. */
export async function listPublishedCoursesForStage(stage: Stage) {
  const raw = await Course.find({ stage, isPublished: true })
    .sort({ order: 1, createdAt: -1 })
    .lean();
  return withLessonCounts(raw);
}

/** All published courses across stages (public landing preview). */
export async function listAllPublishedCourses() {
  const raw = await Course.find({ isPublished: true })
    .sort({ stage: 1, order: 1, createdAt: -1 })
    .lean();
  return withLessonCounts(raw);
}

export async function getPublishedCourseBySlug(
  slug: string,
): Promise<CourseDocument | null> {
  return Course.findOne({ slug, isPublished: true });
}

export async function getCourseById(
  id: string,
): Promise<CourseDocument | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return Course.findById(id);
}

/** Published lessons inside a course, ordered — used on the course detail page. */
export async function listPublishedLessonsForCourse(courseId: Types.ObjectId) {
  return Lesson.find({ courseId, isPublished: true }).sort({
    order: 1,
    createdAt: -1,
  });
}
