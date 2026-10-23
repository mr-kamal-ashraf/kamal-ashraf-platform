import { Types } from "mongoose";
import { Lesson } from "../lessons/lesson.model";
import { Enrollment } from "../enrollments/enrollment.model";
import { LessonProgress } from "./progress.model";
import { ENROLLMENT_STATUS } from "../../config/constants";
import { startOfMonth, startOfNextMonth } from "../../shared/utils/date";

/**
 * Monthly commitment score — how much of what the teacher published THIS MONTH
 * each student actually watched.
 *
 *   نسبة الالتزام = الدروس اللي اتفرجوا عليها الشهر ده ÷ الدروس اللي اتنشرت الشهر ده
 *
 * The denominator is per-student: it counts only lessons published this month
 * inside courses that student actually owns, so a student is never punished for
 * a lesson they were never given access to.
 *
 * "Watched" means the platform's own completion rule (watchedPercentage >=
 * env.LESSON_COMPLETION_THRESHOLD, stored as isCompleted) — the same bar the
 * student's own progress page uses, so the two can never disagree.
 */

export const COMMITMENT_LEVELS = {
  HIGH: "high",     // ملتزم   — 70% فأكثر
  MEDIUM: "medium", // متوسط   — 30% إلى 69%
  LOW: "low",       // ضعيف    — أقل من 30%
} as const;

export type CommitmentLevel =
  (typeof COMMITMENT_LEVELS)[keyof typeof COMMITMENT_LEVELS];

/** Percentage at or above which a student counts as committed. */
export const COMMITMENT_HIGH_THRESHOLD = 70;
/** Percentage at or above which a student counts as average rather than weak. */
export const COMMITMENT_MEDIUM_THRESHOLD = 30;

export interface StudentCommitment {
  /** Lessons published this month in the courses this student owns. */
  releasedLessons: number;
  /** How many of those the student completed. */
  watchedLessons: number;
  /** watchedLessons / releasedLessons as a whole percentage. */
  percentage: number;
  /**
   * null when releasedLessons is 0 — the student owns nothing that was
   * published this month, so there is nothing to judge them on. Never treat
   * that as "weak"; it is "no data".
   */
  level: CommitmentLevel | null;
}

/** Maps a percentage onto the three levels the teacher filters by. */
export function levelFromPercentage(percentage: number): CommitmentLevel {
  if (percentage >= COMMITMENT_HIGH_THRESHOLD) return COMMITMENT_LEVELS.HIGH;
  if (percentage >= COMMITMENT_MEDIUM_THRESHOLD) return COMMITMENT_LEVELS.MEDIUM;
  return COMMITMENT_LEVELS.LOW;
}

/** A student with no lessons released this month — shown as "لا توجد بيانات". */
export const NO_COMMITMENT_DATA: StudentCommitment = {
  releasedLessons: 0,
  watchedLessons: 0,
  percentage: 0,
  level: null,
};

/**
 * Computes the current month's commitment for the given students, or for every
 * enrolled student when `userIds` is omitted.
 *
 * Cost is bounded by the number of lessons PUBLISHED THIS MONTH (a handful for
 * a single teacher), not by the size of the progress collection, so it stays
 * cheap even as watch history grows.
 *
 * Students with no qualifying lessons are simply absent from the returned map.
 */
export async function computeMonthlyCommitment(
  userIds?: Types.ObjectId[],
): Promise<Map<string, StudentCommitment>> {
  const result = new Map<string, StudentCommitment>();

  const monthStart = startOfMonth();
  const monthEnd = startOfNextMonth();

  // 1. What went live this month, and in which course.
  const monthLessons = await Lesson.find(
    {
      isPublished: true,
      publishedAt: { $gte: monthStart, $lt: monthEnd },
    },
    { _id: 1, courseId: 1 },
  ).lean();

  if (monthLessons.length === 0) return result;

  const lessonsByCourse = new Map<string, Types.ObjectId[]>();
  for (const lesson of monthLessons) {
    const key = String(lesson.courseId);
    const bucket = lessonsByCourse.get(key);
    if (bucket) bucket.push(lesson._id);
    else lessonsByCourse.set(key, [lesson._id]);
  }

  // 2. Who owns those courses — this is each student's personal denominator.
  const enrollments = await Enrollment.find(
    {
      status: ENROLLMENT_STATUS.ACTIVE,
      courseId: {
        $in: [...lessonsByCourse.keys()].map((id) => new Types.ObjectId(id)),
      },
      ...(userIds ? { userId: { $in: userIds } } : {}),
    },
    { userId: 1, courseId: 1 },
  ).lean();

  if (enrollments.length === 0) return result;

  const expectedByUser = new Map<string, Set<string>>();
  for (const enrollment of enrollments) {
    const lessons = lessonsByCourse.get(String(enrollment.courseId));
    if (!lessons) continue;
    const key = String(enrollment.userId);
    let bucket = expectedByUser.get(key);
    if (!bucket) {
      bucket = new Set<string>();
      expectedByUser.set(key, bucket);
    }
    for (const lessonId of lessons) bucket.add(String(lessonId));
  }

  if (expectedByUser.size === 0) return result;

  // 3. Which of those lessons each of them actually finished.
  const completed = await LessonProgress.find(
    {
      isCompleted: true,
      userId: { $in: [...expectedByUser.keys()].map((id) => new Types.ObjectId(id)) },
      lessonId: { $in: monthLessons.map((lesson) => lesson._id) },
    },
    { userId: 1, lessonId: 1 },
  ).lean();

  const watchedByUser = new Map<string, Set<string>>();
  for (const record of completed) {
    const key = String(record.userId);
    let bucket = watchedByUser.get(key);
    if (!bucket) {
      bucket = new Set<string>();
      watchedByUser.set(key, bucket);
    }
    bucket.add(String(record.lessonId));
  }

  for (const [userId, expected] of expectedByUser) {
    const watchedSet = watchedByUser.get(userId);
    // Count only lessons this student was actually owed, so watching a lesson
    // from a course they later lost access to cannot push them above 100%.
    let watchedLessons = 0;
    if (watchedSet) {
      for (const lessonId of expected) {
        if (watchedSet.has(lessonId)) watchedLessons += 1;
      }
    }
    const releasedLessons = expected.size;
    const percentage = Math.round((watchedLessons / releasedLessons) * 100);
    result.set(userId, {
      releasedLessons,
      watchedLessons,
      percentage,
      level: levelFromPercentage(percentage),
    });
  }

  return result;
}

/**
 * Student ids matching one commitment level, ordered most committed first —
 * which is exactly the order the teacher asked to see them in.
 *
 * Pure: it ranks a map the caller already computed, so filtering a list never
 * costs a second pass over the database.
 */
export function rankByCommitment(
  scores: Map<string, StudentCommitment>,
  level: CommitmentLevel,
): string[] {
  return [...scores.entries()]
    .filter(([, score]) => score.level === level)
    .sort(([, a], [, b]) => b.percentage - a.percentage)
    .map(([userId]) => userId);
}
