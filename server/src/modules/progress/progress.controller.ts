import type { Request, Response } from "express";
import { Types } from "mongoose";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as progressService from "./progress.service";
import { User } from "../users/user.model";
import type { UpdateProgressInput } from "./progress.validation";

/**
 * POST /progress/:lessonId
 * Sent by the player once each time the student leaves the video.
 * Records how far the student has watched and marks the lesson complete
 * when watchedPercentage reaches LESSON_COMPLETION_THRESHOLD.
 */
export async function update(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const authUser = await User.findById(req.user.id).select("stage").lean();
  if (!authUser) throw ApiError.unauthorized("المستخدم غير موجود", "USER_NOT_FOUND");

  const { lessonId } = req.params;
  if (!Types.ObjectId.isValid(lessonId)) {
    throw ApiError.badRequest("الدرس غير صحيح", "INVALID_LESSON_ID");
  }

  const input = req.body as UpdateProgressInput;
  const progress = await progressService.updateProgress({
    userId: req.user.id,
    lessonId,
    userStage: authUser.stage,
    lastWatchedSecond: input.lastWatchedSecond,
    totalSeconds: input.totalSeconds,
  });

  return sendSuccess(res, {
    data: {
      lastWatchedSecond: progress.lastWatchedSecond,
      watchedPercentage: progress.watchedPercentage,
      isCompleted: progress.isCompleted,
    },
  });
}

/**
 * GET /progress/:lessonId
 * Returns the progress record for the authenticated student and lesson.
 */
export async function get(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();

  const { lessonId } = req.params;
  const progress = await progressService.getProgressForLesson(
    req.user.id,
    lessonId
  );

  return sendSuccess(res, {
    data: progress
      ? {
          lastWatchedSecond: progress.lastWatchedSecond,
          totalSeconds: progress.totalSeconds,
          watchedPercentage: progress.watchedPercentage,
          isCompleted: progress.isCompleted,
        }
      : null,
  });
}

/**
 * GET /progress
 * Returns all progress records for the authenticated student,
 * sorted by most recently watched first.
 */
export async function listMine(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const progress = await progressService.listProgressForUser(req.user.id);
  return sendSuccess(res, { data: { progress } });
}
