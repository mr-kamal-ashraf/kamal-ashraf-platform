import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as courseService from "./course.service";
import { User } from "../users/user.model";
import {
  getOwnedCourseIdSet,
  getActiveEnrollment,
} from "../enrollments/enrollment.service";
import { reconcilePendingForCourse } from "../payments/payment.service";
import { recordAuditLog } from "../audit-logs/audit-log.service";
import { AUDIT_ACTIONS } from "../audit-logs/audit-log.model";
import type {
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesQuery,
  BulkCourseActionInput,
} from "./course.validation";

// ── Student-facing DTOs ──────────────────────────────────────────────────────

/** Public course card fields (safe for any viewer). */
function courseCardDto(c: Record<string, unknown>) {
  return {
    _id: c._id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    stage: c.stage,
    price: c.price,
    thumbnail: c.thumbnail,
    thumbnailGradient: c.thumbnailGradient,
    lessonsCount: c.publishedLessonsCount ?? c.lessonsCount ?? 0,
  };
}

/** A lesson row inside a course — locked (no playable id) unless owned. */
function courseLessonDto(
  lessonJson: Record<string, unknown>,
  owned: boolean,
) {
  return {
    _id: lessonJson._id,
    title: lessonJson.title,
    slug: lessonJson.slug,
    description: lessonJson.description,
    durationMinutes: lessonJson.durationMinutes,
    chapters: lessonJson.chapters,
    order: lessonJson.order,
    thumbnail: lessonJson.thumbnail,
    thumbnailGradient: lessonJson.thumbnailGradient,
    hasVideo: !!lessonJson.bunnyVideoId,
    locked: !owned,
  };
}

// ── Student endpoints ────────────────────────────────────────────────────────

/** GET /courses/preview — published courses across all stages (public landing). */
export async function listPublicPreview(req: Request, res: Response) {
  const courses = await courseService.listAllPublishedCourses();
  // Optional auth: when a logged-in student views the landing page, annotate
  // each card with whether they already own it, so the price badge can flip to
  // "مشترك". Guests get no `owned` flag and simply see the price.
  const ownedIds = req.user ? await getOwnedCourseIdSet(req.user.id) : null;
  return sendSuccess(res, {
    data: {
      courses: courses.map((c) => {
        const record = c as Record<string, unknown>;
        const dto = courseCardDto(record);
        return ownedIds
          ? { ...dto, owned: ownedIds.has(String(record._id)) }
          : dto;
      }),
    },
  });
}

/**
 * GET /courses — published courses for the logged-in student's own stage,
 * each annotated with whether the student already owns it.
 */
export async function listForStudent(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const user = await User.findById(req.user.id).select("stage").lean();
  if (!user) throw ApiError.unauthorized("المستخدم غير موجود", "USER_NOT_FOUND");

  const [courses, ownedIds] = await Promise.all([
    courseService.listPublishedCoursesForStage(user.stage),
    getOwnedCourseIdSet(req.user.id),
  ]);

  return sendSuccess(res, {
    data: {
      courses: courses.map((c) => ({
        ...courseCardDto(c as Record<string, unknown>),
        owned: ownedIds.has(String(c._id)),
      })),
    },
  });
}

/**
 * GET /courses/:slug — course detail + its published lessons. Lessons come back
 * `locked` unless the student owns the course. A student may open the detail
 * page of any course in their own stage (to decide whether to buy); a course
 * from a different stage is treated as not found for them.
 */
export async function getForStudent(req: Request, res: Response) {
  // PUBLIC endpoint: guests can view a course's details to decide whether to
  // buy. When a student IS logged in we additionally mark whether they own it.
  const course = await courseService.getPublishedCourseBySlug(req.params.slug);
  if (!course) {
    throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");
  }

  let owned = false;
  if (req.user) {
    const enrollment = await getActiveEnrollment(req.user.id, course._id);
    owned = !!enrollment;
    // Safety net: a payment still pending here may have been paid with no
    // webhook yet — ask Paymob, and open the course if so.
    if (!owned) owned = await reconcilePendingForCourse(req.user.id, course._id);
  }

  const lessons = await courseService.listPublishedLessonsForCourse(course._id);

  return sendSuccess(res, {
    data: {
      course: {
        _id: course._id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        longDescription: course.longDescription,
        stage: course.stage,
        price: course.price,
        thumbnail: course.thumbnail,
        thumbnailGradient: course.thumbnailGradient,
      },
      owned,
      canBuy: !owned,
      lessons: lessons.map((l) =>
        courseLessonDto(l.toJSON() as Record<string, unknown>, owned),
      ),
    },
  });
}

// ── Admin endpoints ──────────────────────────────────────────────────────────

/**
 * GET /admin/courses/slug-available?slug=&exceptId=
 * Lets the create wizard flag a taken link on the step where it's typed,
 * instead of failing at the very end.
 */
export async function adminSlugAvailable(req: Request, res: Response) {
  const slug = String(req.query.slug ?? "").trim();
  const exceptId = typeof req.query.exceptId === "string" ? req.query.exceptId : undefined;
  const available = !slug || !(await courseService.isCourseSlugTaken(slug, exceptId));
  return sendSuccess(res, { data: { available } });
}

/** POST /admin/courses */
export async function adminCreate(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = req.body as CreateCourseInput;
  const course = await courseService.createCourse(input);

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.CREATE_COURSE,
    targetCourseId: course._id,
    metadata: { title: course.title, slug: course.slug, price: course.price },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "تم إنشاء الكورس",
    data: { course: course.toJSON() },
  });
}

/** GET /admin/courses */
export async function adminList(req: Request, res: Response) {
  const query = req.query as unknown as ListCoursesQuery;
  const result = await courseService.listCoursesForAdmin(query);
  return sendSuccess(res, { data: result });
}

/** POST /admin/courses/bulk-action — applies one action to selected courses. */
export async function adminBulkAction(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = req.body as BulkCourseActionInput;
  const result = await courseService.applyBulkCourseAction(
    input.courseIds,
    input.action,
  );

  const auditAction =
    input.action === "publish"
      ? AUDIT_ACTIONS.PUBLISH_COURSE
      : input.action === "unpublish"
        ? AUDIT_ACTIONS.UNPUBLISH_COURSE
        : AUDIT_ACTIONS.DELETE_COURSE;
  await Promise.all(
    result.processedIds.map((courseId) =>
      recordAuditLog({
        adminId: req.user!.id,
        action: auditAction,
        targetCourseId: courseId,
        metadata: { bulk: true },
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      }),
    ),
  );

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

/** GET /admin/courses/:id */
export async function adminGet(req: Request, res: Response) {
  const course = await courseService.getCourseById(req.params.id);
  if (!course) throw ApiError.notFound("الكورس غير موجود");
  return sendSuccess(res, { data: { course: course.toJSON() } });
}

/** PATCH /admin/courses/:id */
export async function adminUpdate(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = req.body as UpdateCourseInput;
  const course = await courseService.updateCourse(req.params.id, input);

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.UPDATE_COURSE,
    targetCourseId: course._id,
    metadata: { changes: Object.keys(input) },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    message: "تم تحديث الكورس",
    data: { course: course.toJSON() },
  });
}

/** PATCH /admin/courses/:id/publish */
export async function adminTogglePublish(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const isPublished = !!req.body?.isPublished;
  const course = await courseService.setCoursePublished(
    req.params.id,
    isPublished,
  );

  await recordAuditLog({
    adminId: req.user.id,
    action: isPublished
      ? AUDIT_ACTIONS.PUBLISH_COURSE
      : AUDIT_ACTIONS.UNPUBLISH_COURSE,
    targetCourseId: course._id,
    metadata: { title: course.title },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    message: isPublished ? "تم نشر الكورس" : "تم إخفاء الكورس",
    data: { course: course.toJSON() },
  });
}

/** DELETE /admin/courses/:id */
export async function adminDelete(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await courseService.deleteCourse(req.params.id);

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.DELETE_COURSE,
    targetCourseId: req.params.id,
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, { message: "تم حذف الكورس" });
}

/** POST /admin/courses/:id/thumbnail */
export async function adminUploadThumbnail(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  if (!req.file) throw ApiError.badRequest("لازم ترفع صورة", "NO_FILE");

  const course = await courseService.setCourseThumbnailFromUpload(
    req.params.id,
    req.file.filename,
  );

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.UPDATE_COURSE,
    targetCourseId: course._id,
    metadata: { changes: ["thumbnail"] },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    message: "تم رفع صورة الكورس",
    data: { course: course.toJSON() },
  });
}

/** DELETE /admin/courses/:id/thumbnail */
export async function adminClearThumbnail(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const course = await courseService.clearCourseThumbnail(req.params.id);

  await recordAuditLog({
    adminId: req.user.id,
    action: AUDIT_ACTIONS.UPDATE_COURSE,
    targetCourseId: course._id,
    metadata: { changes: ["thumbnail-cleared"] },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    message: "تم حذف الصورة",
    data: { course: course.toJSON() },
  });
}
