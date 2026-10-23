import { Types } from "mongoose";
import { Enrollment, type EnrollmentDocument } from "./enrollment.model";
import { Course } from "../courses/course.model";
import { User } from "../users/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import {
  ENROLLMENT_SOURCE,
  ENROLLMENT_STATUS,
  type EnrollmentSource,
  type Stage,
} from "../../config/constants";

/**
 * Returns the student's ACTIVE enrollment for a course, or null.
 * This is the single access check the rest of the platform relies on.
 */
export async function getActiveEnrollment(
  userId: string | Types.ObjectId,
  courseId: string | Types.ObjectId,
): Promise<EnrollmentDocument | null> {
  return Enrollment.findOne({
    userId,
    courseId,
    status: ENROLLMENT_STATUS.ACTIVE,
  });
}

/** True when the student currently owns (active) the given course. */
export async function ownsCourse(
  userId: string | Types.ObjectId,
  courseId: string | Types.ObjectId,
): Promise<boolean> {
  const enrollment = await getActiveEnrollment(userId, courseId);
  return !!enrollment;
}

/**
 * Returns the set of course ids the student actively owns, as strings.
 * Used to annotate a course list with an `owned` flag in one query.
 */
export async function getOwnedCourseIdSet(
  userId: string | Types.ObjectId,
): Promise<Set<string>> {
  const rows = await Enrollment.find({
    userId,
    status: ENROLLMENT_STATUS.ACTIVE,
  })
    .select("courseId")
    .lean();
  return new Set(rows.map((r) => String(r.courseId)));
}

interface GrantInput {
  userId: string | Types.ObjectId;
  courseId: string | Types.ObjectId;
  source: EnrollmentSource;
  amountPaid: number;
  grantedBy?: string | Types.ObjectId | null; // admin (cash grants)
  paymentId?: string | Types.ObjectId | null; // payment (paymob)
  notes?: string | null;
  stage?: Stage; // optional override; otherwise taken from the course
}

interface GrantResult {
  enrollment: EnrollmentDocument;
  newlyGranted: boolean;
}

/**
 * Grants (or re-activates) a student's ownership of a course.
 *
 * Idempotent per (userId, courseId): if a record already exists it is updated
 * and re-activated rather than duplicated. Returns the enrollment plus a flag
 * saying whether this call actually created/newly-activated access (so the
 * caller can avoid double-charging / duplicate audit logs).
 */
export async function grantCourseAccess(input: GrantInput): Promise<GrantResult> {
  return (await activateEnrollment(input)) as GrantResult;
}

/**
 * A grant from a payment: refused (null) when the teacher revoked the course
 * at or after `since` — when the payment started — so an old payment never
 * undoes that decision. The check is part of the grant's own write, so a
 * revoke landing at the same moment still wins.
 */
export async function grantCourseAccessUnlessRevokedSince(
  input: GrantInput,
  since: Date,
): Promise<GrantResult | null> {
  return activateEnrollment(input, since);
}

/**
 * One atomic upsert: two grants (or a grant and a revoke) racing each other
 * can't overwrite one another half-way, or trip the one-record-per-student
 * index.
 */
async function activateEnrollment(
  input: GrantInput,
  notRevokedSince?: Date,
): Promise<GrantResult | null> {
  const course = await Course.findById(input.courseId).select("stage");
  if (!course) {
    throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");
  }

  const key = { userId: input.userId, courseId: input.courseId };
  const revokedSince = notRevokedSince && {
    status: ENROLLMENT_STATUS.REVOKED,
    revokedAt: { $gte: notRevokedSince },
  };
  const set: Record<string, unknown> = {
    status: ENROLLMENT_STATUS.ACTIVE,
    source: input.source,
    amountPaid: input.amountPaid,
    stage: input.stage ?? course.stage,
    revokedAt: null,
    revokedBy: null,
  };
  if (input.grantedBy) set.grantedBy = new Types.ObjectId(String(input.grantedBy));
  if (input.paymentId) set.paymentId = new Types.ObjectId(String(input.paymentId));
  if (input.notes !== undefined) set.notes = input.notes;

  // Answers with the record as it was before (null when this call created it).
  const upsert = () =>
    Enrollment.findOneAndUpdate(
      revokedSince ? { ...key, $nor: [revokedSince] } : key,
      { $set: set },
      { upsert: true, new: false, setDefaultsOnInsert: true, runValidators: true },
    ).lean();

  let before;
  try {
    before = await upsert();
  } catch (err) {
    // The filter passed over an existing record, so the upsert tried to add a
    // second one: it was revoked since (refuse), or a parallel first grant
    // created it a moment ago (update that one).
    if ((err as { code?: number }).code !== 11000) throw err;
    if (revokedSince && (await Enrollment.exists({ ...key, ...revokedSince }))) {
      return null;
    }
    before = await upsert();
  }

  const newlyGranted = before?.status !== ENROLLMENT_STATUS.ACTIVE;
  // A re-buy after a revoke reuses the record (createdAt is the first
  // purchase), so the sale date is kept on its own. An already-open course
  // keeps its date — a second payment for it isn't a new sale.
  if (newlyGranted) {
    await Enrollment.updateOne(key, { $set: { grantedAt: new Date() } });
  }

  const enrollment = await Enrollment.findOne(key);
  if (!enrollment) {
    throw ApiError.internal("معلش، مقدرناش نفتح الكورس دلوقتي، حاول تاني.");
  }
  return { enrollment, newlyGranted };
}

/**
 * Admin manual (cash) grant: opens a course for a student who paid in person.
 * Validates the student and course exist, records amountPaid = course price.
 * Does NOT enforce a stage match — an admin can open any course deliberately.
 */
export async function grantCashAccess(input: {
  userId: string;
  courseId: string;
  grantedBy: string;
  notes?: string | null;
  amountPaid?: number; // actual cash received; falls back to the course price
}): Promise<{ enrollment: EnrollmentDocument; newlyGranted: boolean }> {
  const [user, course] = await Promise.all([
    User.findById(input.userId),
    Course.findById(input.courseId),
  ]);
  if (!user) throw ApiError.notFound("الطالب غير موجود", "USER_NOT_FOUND");
  if (!course) throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");

  // A student can only reach a course through the published-course endpoints, so
  // granting an unpublished (draft) course would hand them an enrollment they can
  // never actually open. Refuse it and tell the admin to publish the course first.
  if (!course.isPublished) {
    throw ApiError.badRequest(
      "الكورس ده لسه مش منشور — انشره الأول قبل ما تفتحه لطالب",
      "COURSE_NOT_PUBLISHED",
    );
  }

  return grantCourseAccess({
    userId: input.userId,
    courseId: input.courseId,
    source: ENROLLMENT_SOURCE.CASH,
    // Record what the student ACTUALLY paid in cash when the admin provides it;
    // otherwise fall back to the course's list price.
    amountPaid: input.amountPaid ?? course.price,
    grantedBy: input.grantedBy,
    notes: input.notes ?? null,
    stage: course.stage,
  });
}

/**
 * Revokes a student's access to a course (sets status = revoked) — in one
 * conditional write, so it can't interleave with a grant.
 */
export async function revokeCourseAccess(
  userId: string | Types.ObjectId,
  courseId: string | Types.ObjectId,
  revokedBy: string | Types.ObjectId,
): Promise<void> {
  const { matchedCount } = await Enrollment.updateOne(
    { userId, courseId, status: ENROLLMENT_STATUS.ACTIVE },
    {
      $set: {
        status: ENROLLMENT_STATUS.REVOKED,
        revokedAt: new Date(),
        revokedBy: new Types.ObjectId(String(revokedBy)),
      },
    },
  );
  if (matchedCount === 0) {
    throw ApiError.notFound("الطالب مش مشترك في الكورس ده", "NOT_ENROLLED");
  }
}

/** Lists a student's enrollments (any status) with the course populated. */
export async function listEnrollmentsForUser(userId: string | Types.ObjectId) {
  return Enrollment.find({ userId })
    .sort({ createdAt: -1 })
    .populate("courseId", "title slug stage price thumbnail thumbnailGradient isPublished")
    .lean();
}

/** Counts active enrollments for a course (used before deleting a course). */
export async function countActiveEnrollmentsForCourse(
  courseId: string | Types.ObjectId,
): Promise<number> {
  return Enrollment.countDocuments({
    courseId,
    status: ENROLLMENT_STATUS.ACTIVE,
  });
}
