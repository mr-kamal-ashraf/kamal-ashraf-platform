import type { Request, Response } from "express";
import fs from "fs";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as lessonService from "./lesson.service";
import { generateSignedPlaybackUrl } from "../bunny/bunny.service";
import { isBunnyConfigured } from "../bunny/bunny.client";
import { getProgressForLesson } from "../progress/progress.service";
import {
  getActiveEnrollment,
  getOwnedCourseIdSet,
} from "../enrollments/enrollment.service";
import { Course } from "../courses/course.model";
import { Lesson } from "./lesson.model";
import { User } from "../users/user.model";
import { ACCESS_DENIAL_REASONS, VIDEO_STATUS } from "../../config/constants";
import type {
  CreateLessonInput,
  UpdateLessonInput,
  ListLessonsQuery,
  BulkLessonActionInput,
} from "./lesson.validation";
import type { Stage } from "../../config/constants";
import { recordAuditLog } from "../audit-logs/audit-log.service";
import { AUDIT_ACTIONS } from "../audit-logs/audit-log.model";
import { env } from "../../config/env";
import { notifyCourseOwnersAboutPublishedLesson } from "../notifications/lesson-published.service";

function extractBunnyVideoIdFromThumbnailUrl(thumb: string): string | null {
  if (!env.BUNNY_PULL_ZONE) return null;
  const hostPrefix = `https://${env.BUNNY_PULL_ZONE}/`;
  const hostPrefixHttp = `http://${env.BUNNY_PULL_ZONE}/`;
  let rest: string | null = null;
  if (thumb.startsWith(hostPrefix)) rest = thumb.slice(hostPrefix.length);
  else if (thumb.startsWith(hostPrefixHttp))
    rest = thumb.slice(hostPrefixHttp.length);
  if (!rest) return null;
  const id = rest.split("/")[0]?.split("?")[0];
  if (!id || !/^[\w-]{8,128}$/i.test(id)) return null;
  return id;
}

/**
 * When Bunny CDN token auth is on, raw thumbnail.jpg URLs are blocked without a token.
 * Replace with a short-lived signed URL scoped to the video folder (same as playback).
 */
function attachSignedBunnyThumbnail(
  lesson: Record<string, unknown>,
  ip: string | undefined,
): void {
  if (!isBunnyConfigured()) return;
  const thumb = lesson.thumbnail;
  if (typeof thumb !== "string" || !thumb || !/^https:\/\//i.test(thumb)) {
    return;
  }
  if (!env.BUNNY_PULL_ZONE || !thumb.includes(env.BUNNY_PULL_ZONE)) return;

  let videoId =
    typeof lesson.bunnyVideoId === "string" && lesson.bunnyVideoId
      ? lesson.bunnyVideoId
      : null;
  if (!videoId) {
    videoId = extractBunnyVideoIdFromThumbnailUrl(thumb);
  }
  if (!videoId) return;

  try {
    lesson.thumbnail = generateSignedPlaybackUrl({
      videoId,
      ipAddress: ip,
      pathSuffix: "thumbnail.jpg",
    });
  } catch {
    /* leave original thumbnail */
  }
}

/**
 * Ensures the student owns the course this lesson belongs to. Throws a 403
 * NOT_ENROLLED (with the course slug so the frontend can redirect to the
 * purchase page) when they don't.
 */
async function assertOwnsLessonCourse(
  userId: string,
  lesson: { courseId: unknown },
): Promise<void> {
  const courseId = String(lesson.courseId);
  const enrollment = await getActiveEnrollment(userId, courseId);
  if (enrollment) return;
  const course = await Course.findById(courseId).select("slug").lean();
  throw ApiError.forbidden(
    "لازم تشتري الكورس الأول عشان تفتح الدرس ده",
    ACCESS_DENIAL_REASONS.NOT_ENROLLED,
    { courseId, courseSlug: course?.slug ?? null },
  );
}

// Strips server-only fields (bunnyVideoId, internal flags) before
// sending a lesson to unauthenticated or student-facing endpoints.
function publicLessonDto(lessonDoc: ReturnType<typeof Object>) {
  const obj = (lessonDoc as { toJSON: () => Record<string, unknown> }).toJSON();
  return {
    _id: obj._id,
    title: obj.title,
    slug: obj.slug,
    description: obj.description,
    longDescription: obj.longDescription,
    stage: obj.stage,
    durationMinutes: obj.durationMinutes,
    chapters: obj.chapters,
    topics: obj.topics,
    thumbnail: obj.thumbnail,
    thumbnailGradient: obj.thumbnailGradient,
  };
}

/** GET /lessons/preview — returns all published lessons (no auth required, fields stripped). */
export async function listPublicPreview(req: Request, res: Response) {
  const lessons = await lessonService.listAllPublishedLessons();
  return sendSuccess(res, {
    data: {
      lessons: lessons.map((l) => {
        const dto = publicLessonDto(l) as Record<string, unknown>;
        attachSignedBunnyThumbnail(dto, req.ip);
        return dto;
      }),
    },
  });
}

/** GET /lessons/preview/:slug — returns a single published lesson for the landing page. */
export async function getPublicPreview(req: Request, res: Response) {
  const slug = String(req.params.slug);
  const lesson = await lessonService.getPublishedLessonBySlug(slug);
  if (!lesson) {
    return sendSuccess(res, { data: null });
  }
  const dto = publicLessonDto(lesson) as Record<string, unknown>;
  attachSignedBunnyThumbnail(dto, req.ip);
  return sendSuccess(res, { data: { lesson: dto } });
}

/** GET /lessons — returns published lessons filtered to the student's own stage. */
export async function listForStudent(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();

  // A student's accessible lessons = published lessons inside the courses they own.
  const ownedIds = await getOwnedCourseIdSet(req.user.id);
  const lessons = await lessonService.listPublishedLessonsForCourses([
    ...ownedIds,
  ]);
  return sendSuccess(res, {
    data: {
      lessons: lessons.map((l) => {
        const j = l.toJSON() as Record<string, unknown>;
        attachSignedBunnyThumbnail(j, req.ip);
        return j;
      }),
    },
  });
}

/**
 * GET /lessons/:slug — returns full lesson data + watch progress for a student.
 * Returns STAGE_MISMATCH if the lesson exists but is for a different stage.
 */
export async function getForStudent(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const user = await User.findById(req.user.id).select("stage").lean();
  if (!user)
    throw ApiError.unauthorized("المستخدم غير موجود", "USER_NOT_FOUND");

  const { slug } = req.params;
  const lesson = await lessonService.getPublishedLessonBySlugForStage(
    slug,
    user.stage,
  );

  if (!lesson) {
    const anyStageLesson = await lessonService.getPublishedLessonBySlug(slug);
    if (anyStageLesson && anyStageLesson.stage !== user.stage) {
      throw ApiError.forbidden(
        "الدرس ده مش لمرحلتك",
        ACCESS_DENIAL_REASONS.STAGE_MISMATCH,
      );
    }
    throw ApiError.notFound(
      "الدرس غير موجود",
      ACCESS_DENIAL_REASONS.LESSON_NOT_FOUND,
    );
  }

  // Course-ownership gate: the lesson is only viewable if the student owns its course.
  await assertOwnsLessonCourse(req.user.id, lesson);

  const progress = await getProgressForLesson(
    req.user.id,
    lesson._id.toString(),
  );

  const lessonJson = lesson.toJSON() as Record<string, unknown>;
  attachSignedBunnyThumbnail(lessonJson, req.ip);

  return sendSuccess(res, {
    data: {
      lesson: lessonJson,
      progress: progress
        ? {
            lastWatchedSecond: progress.lastWatchedSecond,
            watchedPercentage: progress.watchedPercentage,
            isCompleted: progress.isCompleted,
          }
        : null,
    },
  });
}

/**
 * GET /lessons/:slug/video-url — generates a short-lived signed Bunny playback URL.
 * The URL includes a HMAC token + expiry so it cannot be shared or replayed.
 * Stage check is enforced here too so students can't guess another stage's URL.
 */
export async function getVideoUrlForStudent(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const user = await User.findById(req.user.id).select("stage").lean();
  if (!user)
    throw ApiError.unauthorized("المستخدم غير موجود", "USER_NOT_FOUND");

  const { slug } = req.params;
  const lesson = await lessonService.getPublishedLessonBySlugForStage(
    slug,
    user.stage,
  );

  if (!lesson) {
    const anyStageLesson = await lessonService.getPublishedLessonBySlug(slug);
    if (anyStageLesson && anyStageLesson.stage !== user.stage) {
      throw ApiError.forbidden(
        "الدرس ده مش لمرحلتك",
        ACCESS_DENIAL_REASONS.STAGE_MISMATCH,
      );
    }
    throw ApiError.notFound(
      "الدرس غير موجود",
      ACCESS_DENIAL_REASONS.LESSON_NOT_FOUND,
    );
  }

  // Course-ownership gate before handing out a playable signed URL.
  await assertOwnsLessonCourse(req.user.id, lesson);

  if (!lesson.bunnyVideoId) {
    throw ApiError.notFound("لسه مفيش فيديو للدرس ده", "NO_VIDEO");
  }

  if (!isBunnyConfigured()) {
    throw ApiError.internal("خدمة الفيديو مش متاحة حالياً، حاول تاني بعدين.");
  }

  // A video Bunny is still converting would play as a black screen — say so
  // instead. (A ready video skips this without asking Bunny anything.)
  const { status } = await lessonService.syncLessonVideo(lesson);
  if (status === VIDEO_STATUS.PROCESSING) {
    throw ApiError.conflict(
      "الأستاذ رفع الفيديو وبيتجهز دلوقتي — جرّب تاني كمان دقايق.",
      "VIDEO_PROCESSING",
    );
  }
  if (status === VIDEO_STATUS.FAILED) {
    throw ApiError.conflict(
      "الفيديو ده فيه مشكلة ومش هيشتغل دلوقتي — الأستاذ هيرفعه تاني قريب.",
      "VIDEO_FAILED",
    );
  }
  // null: not known yet (an older lesson, or Bunny didn't answer) — let it play.

  const signedUrl = generateSignedPlaybackUrl({
    videoId: lesson.bunnyVideoId,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    data: {
      url: signedUrl,
      videoId: lesson.bunnyVideoId,
      durationSeconds: lesson.videoDurationSeconds,
    },
  });
}

/** POST /admin/lessons — creates a new lesson and records an audit log entry. */
/**
 * GET /admin/lessons/slug-available?slug=&exceptId=
 * Lets the create wizard flag a taken link on the step where it's typed.
 */
export async function adminSlugAvailable(req: Request, res: Response) {
  const slug = String(req.query.slug ?? "").trim();
  const exceptId = typeof req.query.exceptId === "string" ? req.query.exceptId : undefined;
  const available = !slug || !(await lessonService.isLessonSlugTaken(slug, exceptId));
  return sendSuccess(res, { data: { available } });
}

export async function adminCreate(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = req.body as CreateLessonInput;
  const lesson = await lessonService.createLesson(input);

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.CREATE_LESSON,
    targetLessonId: lesson._id,
    metadata: { title: lesson.title, slug: lesson.slug },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "تم إنشاء الدرس",
    data: { lesson: lesson.toJSON() },
  });
}

/**
 * POST /admin/lessons/:id/video — uploads a video to Bunny Stream.
 * The temp file (written by multer) is always deleted in the finally block,
 * whether the upload succeeds or fails.
 */
export async function adminUploadVideo(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  if (!req.file) throw ApiError.badRequest("لازم ترفع فيديو", "NO_FILE");

  try {
    const lesson = await lessonService.uploadLessonVideo(
      req.params.id,
      req.file.path,
    );

    return sendSuccess(res, {
      message: "تم رفع الفيديو بنجاح",
      data: { lesson: lesson.toJSON() },
    });
  } finally {
    fs.unlink(req.file.path, () => undefined);
  }
}

/**
 * POST /admin/lessons/:id/thumbnail — uploads the lesson thumbnail to Cloudinary.
 */
export async function adminUploadThumbnail(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  if (!req.file) throw ApiError.badRequest("لازم ترفع صورة", "NO_FILE");

  const lesson = await lessonService.setLessonThumbnailFromUpload(
    req.params.id,
    req.file.filename,
  );

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.UPDATE_LESSON,
    targetLessonId: lesson._id,
    metadata: { changes: ["thumbnail"] },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    message: "تم رفع صورة الدرس",
    data: { lesson: lesson.toJSON() },
  });
}

/** DELETE /admin/lessons/:id/thumbnail — removes the thumbnail (Cloudinary or legacy disk). */
export async function adminClearThumbnail(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const lesson = await lessonService.clearLessonThumbnail(req.params.id);

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.UPDATE_LESSON,
    targetLessonId: lesson._id,
    metadata: { changes: ["thumbnail-cleared"] },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    message: "تم حذف الصورة",
    data: { lesson: lesson.toJSON() },
  });
}

/** PATCH /admin/lessons/:id — updates metadata fields and records an audit log entry. */
export async function adminUpdate(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = req.body as UpdateLessonInput;
  const lesson = await lessonService.updateLesson(req.params.id, input);

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.UPDATE_LESSON,
    targetLessonId: lesson._id,
    metadata: { changes: Object.keys(input) },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    message: "تم تحديث الدرس",
    data: { lesson: lesson.toJSON() },
  });
}

/** PATCH /admin/lessons/:id/publish — publishes or unpublishes a lesson. */
export async function adminTogglePublish(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const isPublished = !!req.body?.isPublished;
  const { lesson, publishedNow } = await lessonService.setLessonPublished(
    req.params.id,
    isPublished,
  );

  await recordAuditLog({
    adminId: req.user.id,
    action: isPublished
      ? AUDIT_ACTIONS.PUBLISH_LESSON
      : AUDIT_ACTIONS.UNPUBLISH_LESSON,
    targetLessonId: lesson._id,
    metadata: { title: lesson.title },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  // A notification is sent only the FIRST time a lesson becomes public. The
  // async job is deliberately detached from this request: publishing remains
  // fast and succeeds even if WhatsApp is disconnected or a recipient fails.
  if (publishedNow) {
    const course = await Course.findById(lesson.courseId)
      .select("title")
      .lean();
    if (course) {
      void notifyCourseOwnersAboutPublishedLesson({
        courseId: String(lesson.courseId),
        courseTitle: course.title,
        lessonTitle: lesson.title,
        lessonSlug: lesson.slug,
      });
    }
  }

  return sendSuccess(res, {
    message: isPublished ? "تم نشر الدرس" : "تم إخفاء الدرس",
    data: { lesson: lesson.toJSON() },
  });
}

/** POST /admin/lessons/bulk-action — applies one action to selected lessons. */
export async function adminBulkAction(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = req.body as BulkLessonActionInput;
  const result = await lessonService.applyBulkLessonAction(
    input.lessonIds,
    input.action,
  );

  const auditAction =
    input.action === "publish"
      ? AUDIT_ACTIONS.PUBLISH_LESSON
      : input.action === "unpublish"
        ? AUDIT_ACTIONS.UNPUBLISH_LESSON
        : AUDIT_ACTIONS.DELETE_LESSON;
  await Promise.all(
    result.processedIds.map((lessonId) =>
      recordAuditLog({
        adminId: req.user!.id,
        action: auditAction,
        targetLessonId: lessonId,
        metadata: { bulk: true },
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      }),
    ),
  );

  // Match the individual publish behavior: each lesson sends a notification
  // only on its first successful transition to published.
  if (result.publishedNowIds.length > 0) {
    const publishedLessons = await Lesson.find({
      _id: { $in: result.publishedNowIds },
    })
      .select("courseId title slug")
      .lean();
    const courseIds = [...new Set(publishedLessons.map((lesson) => String(lesson.courseId)))];
    const courses = await Course.find({ _id: { $in: courseIds } })
      .select("_id title")
      .lean();
    const courseTitles = new Map(courses.map((course) => [String(course._id), course.title]));
    publishedLessons.forEach((lesson) => {
      const courseTitle = courseTitles.get(String(lesson.courseId));
      if (!courseTitle) return;
      void notifyCourseOwnersAboutPublishedLesson({
        courseId: String(lesson.courseId),
        courseTitle,
        lessonTitle: lesson.title,
        lessonSlug: lesson.slug,
      });
    });
  }

  return sendSuccess(res, {
    data: {
      action: input.action,
      processed: result.processedIds.length,
      processedIds: result.processedIds,
      missingIds: result.missingIds,
      failedIds: result.failedIds,
    },
  });
}

/** DELETE /admin/lessons/:id — deletes lesson + Bunny video + any local thumbnail. */
export async function adminDelete(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await lessonService.deleteLesson(req.params.id);

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.DELETE_LESSON,
    targetLessonId: req.params.id,
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, { message: "تم حذف الدرس" });
}

/** GET /admin/lessons — paginated list with optional stage/status/search filters. */
export async function adminList(req: Request, res: Response) {
  const query = req.query as unknown as ListLessonsQuery;
  const result = await lessonService.listLessonsForAdmin(query);
  return sendSuccess(res, {
    data: result,
  });
}

/** GET /admin/lessons/:id — fetches a single lesson by ID (any publish state). */
export async function adminGet(req: Request, res: Response) {
  const lesson = await lessonService.getLessonById(req.params.id);
  if (!lesson) throw ApiError.notFound("الدرس غير موجود");
  await lessonService.syncLessonVideo(lesson);
  return sendSuccess(res, { data: { lesson: lesson.toJSON() } });
}

/**
 * GET /admin/lessons/:id/video-status — where the video is on Bunny. Polled
 * by the lesson's edit page only while the video is still converting.
 */
export async function adminVideoStatus(req: Request, res: Response) {
  const lesson = await lessonService.getLessonById(req.params.id);
  if (!lesson) throw ApiError.notFound("الدرس غير موجود");
  const video = await lessonService.syncLessonVideo(lesson, { force: true });
  return sendSuccess(res, {
    data: {
      videoStatus: video.status,
      videoDurationSeconds: video.durationSeconds,
      encodeProgress: video.encodeProgress,
    },
  });
}
