import { Types } from "mongoose";
import {
  LessonProgress,
  type LessonProgressDocument,
} from "./progress.model";
import { Lesson } from "../lessons/lesson.model";
import { ownsCourse } from "../enrollments/enrollment.service";
import { ApiError } from "../../shared/utils/ApiError";
import { env } from "../../config/env";
import {
  ACCESS_DENIAL_REASONS,
  type Stage,
} from "../../config/constants";

/**
 * Returns the progress record for a specific lesson for a student.
 * Returns null if the student has never started watching this lesson.
 */
export async function getProgressForLesson(
  userId: string | Types.ObjectId,
  lessonId: string | Types.ObjectId
): Promise<LessonProgressDocument | null> {
  if (!Types.ObjectId.isValid(lessonId.toString())) return null;
  return LessonProgress.findOne({ userId, lessonId });
}

interface UpdateProgressInput {
  userId: string | Types.ObjectId;
  lessonId: string | Types.ObjectId;
  userStage: Stage;
  lastWatchedSecond: number;
  totalSeconds?: number;
}

/**
 * Records or updates a student's watch progress for a lesson (heartbeat).
 *
 * Business rules enforced:
 *  - Lesson must exist and be published.
 *  - Lesson must belong to the student's academic stage.
 *  - lastWatchedSecond is only advanced forward (never goes backward).
 *  - isCompleted is set to true once watchedPercentage >= LESSON_COMPLETION_THRESHOLD.
 *
 * Uses findOneAndUpdate with upsert:true so the first heartbeat creates the record
 * and subsequent ones update it atomically.
 */
export async function updateProgress(
  input: UpdateProgressInput
): Promise<LessonProgressDocument> {
  if (!Types.ObjectId.isValid(input.lessonId.toString())) {
    throw ApiError.badRequest("الدرس غير صحيح", "INVALID_LESSON_ID");
  }

  const lesson = await Lesson.findById(input.lessonId).select(
    "videoDurationSeconds stage isPublished courseId"
  );
  if (!lesson) throw ApiError.notFound("الدرس غير موجود", "LESSON_NOT_FOUND");

  // Course-ownership gate: a student can only record progress on lessons
  // inside a course they own.
  const owns = await ownsCourse(input.userId, lesson.courseId);
  if (!owns) {
    throw ApiError.forbidden(
      "لازم تشتري الكورس الأول",
      ACCESS_DENIAL_REASONS.NOT_ENROLLED
    );
  }

  // Don't let students record progress for lessons outside their stage
  // or unpublished lessons — closes a low-impact data-tampering vector.
  if (lesson.stage !== input.userStage) {
    throw ApiError.forbidden(
      "الدرس ده مش لمرحلتك",
      ACCESS_DENIAL_REASONS.STAGE_MISMATCH
    );
  }
  if (!lesson.isPublished) {
    throw ApiError.forbidden(
      "الدرس غير متاح",
      ACCESS_DENIAL_REASONS.LESSON_NOT_PUBLISHED
    );
  }

  // The duration Bunny reported wins; the browser's figure only fills in
  // until Bunny's is known (it's the student's to send, so it can't be trusted
  // to decide completion on its own).
  const totalSeconds =
    lesson.videoDurationSeconds > 0
      ? lesson.videoDurationSeconds
      : input.totalSeconds && input.totalSeconds > 0
        ? input.totalSeconds
        : 0;

  const incomingSecond = Math.max(0, Math.floor(input.lastWatchedSecond));

  // ── Fetch existing record to enforce "never go backward" rule ──────────
  const existing = await LessonProgress.findOne({
    userId: input.userId,
    lessonId: input.lessonId,
  });

  // Keep the highest watched second — prevents rewind from losing progress.
  const last = existing
    ? Math.max(existing.lastWatchedSecond, incomingSecond)
    : incomingSecond;

  const watchedPercentage =
    totalSeconds > 0 ? Math.min(100, Math.round((last / totalSeconds) * 100)) : 0;

  // Once completed, never revert to incomplete.
  const isCompleted =
    (existing?.isCompleted === true) ||
    watchedPercentage >= env.LESSON_COMPLETION_THRESHOLD;

  // The same rules again inside the write itself ($max, and "completed" only
  // ever set to true): two heartbeats racing (two tabs) can't move progress
  // backwards or un-complete a lesson with what they read a moment earlier.
  const update: Record<string, unknown> = {
    totalSeconds,
    lastWatchedAt: new Date(),
  };
  if (isCompleted) update.isCompleted = true;

  // Only set completedAt the first time the lesson is completed.
  if (isCompleted && !existing?.completedAt) {
    update.completedAt = new Date();
  }

  const progress = await LessonProgress.findOneAndUpdate(
    { userId: input.userId, lessonId: input.lessonId },
    {
      $set: update,
      $max: { lastWatchedSecond: last, watchedPercentage },
      $setOnInsert: { firstWatchedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (!progress) throw ApiError.internal("معلش، مقدرناش نحفظ تقدّمك دلوقتي، حاول تاني.");
  return progress;
}

/**
 * Returns all progress records for a student, optionally filtered to only
 * completed lessons. Sorted by most recently watched first.
 */
export async function listProgressForUser(
  userId: string | Types.ObjectId
) {
  return LessonProgress.find({ userId })
    .sort({ lastWatchedAt: -1 })
    .populate("lessonId", "title slug stage durationMinutes thumbnail")
    .lean();
}

export async function deleteProgressForUser(
  userId: string | Types.ObjectId
): Promise<number> {
  const result = await LessonProgress.deleteMany({ userId });
  return result.deletedCount;
}
