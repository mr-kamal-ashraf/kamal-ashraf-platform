import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { User, type UserDocument } from "./user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { env } from "../../config/env";
import { STAGES, type Stage } from "../../config/constants";
import { revokeAllUserSessions } from "../sessions/session.service";
import { ROLES } from "../../config/constants";
import { listProgressForUser } from "../progress/progress.service";
import { listEnrollmentsForUser } from "../enrollments/enrollment.service";
import { Session } from "../sessions/session.model";
import { LessonProgress } from "../progress/progress.model";
import { Enrollment } from "../enrollments/enrollment.model";
import { SupportEscalation } from "../support/escalation.model";
import { buildSafeRegex } from "../../shared/utils/regex";
import {
  computeMonthlyCommitment,
  rankByCommitment,
  NO_COMMITMENT_DATA,
  type CommitmentLevel,
  type StudentCommitment,
} from "../progress/commitment.service";

interface ListUsersFilter {
  search?: string;
  stage?: Stage;
  status?: "active" | "pending" | "suspended" | "expired";
  commitment?: CommitmentLevel;
  page?: number;
  limit?: number;
}

export type BulkStudentAction = "suspend" | "unsuspend" | "delete";

export interface BulkStudentActionResult {
  processedIds: string[];
  missingIds: string[];
  failedIds: string[];
  deletedSnapshots: Map<string, { deletedName: string; deletedPhone: string }>;
}

/** A student row plus this month's commitment score, as the admin list returns it. */
type StudentListRow = Record<string, unknown> & {
  commitment: StudentCommitment;
};

/**
 * Builds the Mongo filter shared by every student query (stage, account status,
 * free-text search). Kept separate so the commitment path can reuse the exact
 * same rules instead of duplicating them.
 */
function buildStudentFilter(filter: ListUsersFilter): Record<string, unknown> {
  const mongoFilter: Record<string, unknown> = {};

  if (filter.stage) mongoFilter.stage = filter.stage;
  if (filter.status === "suspended") mongoFilter.isSuspended = true;
  if (filter.status === "pending") mongoFilter.isActive = false;
  if (filter.status === "active") {
    mongoFilter.isActive = true;
    mongoFilter.isSuspended = false;
  }

  if (filter.search) {
    const safe = buildSafeRegex(filter.search);
    mongoFilter.$or = [
      { firstName: safe },
      { secondName: safe },
      { thirdName: safe },
      { studentPhone: safe },
      { parentPhone: safe },
    ];
  }

  return mongoFilter;
}

/** Attaches a student's commitment score, defaulting to "no data" when absent. */
function withCommitment(
  student: Record<string, unknown>,
  scores: Map<string, StudentCommitment>,
): StudentListRow {
  return {
    ...student,
    commitment: scores.get(String(student._id)) ?? NO_COMMITMENT_DATA,
  };
}

/**
 * Students filtered by this month's commitment band, ordered most committed
 * first.
 *
 * The ordering lives in the score map rather than in Mongo, so the page is
 * selected from the ranked id list and the documents are re-sorted back into
 * that order after fetching.
 */
async function listStudentsByCommitment(
  mongoFilter: Record<string, unknown>,
  level: CommitmentLevel,
  page: number,
  limit: number,
) {
  const scores = await computeMonthlyCommitment();
  const rankedIds = rankByCommitment(scores, level);

  const empty = {
    items: [] as StudentListRow[],
    total: 0,
    page,
    limit,
    totalPages: 0,
  };
  if (rankedIds.length === 0) return empty;

  // Apply the other filters (stage / status / search) to the ranked candidates.
  const allowed = await User.find(
    {
      ...mongoFilter,
      _id: { $in: rankedIds.map((id) => new Types.ObjectId(id)) },
    },
    { _id: 1 },
  ).lean();

  const allowedIds = new Set(allowed.map((student) => String(student._id)));
  const orderedIds = rankedIds.filter((id) => allowedIds.has(id));
  const total = orderedIds.length;
  if (total === 0) return empty;

  const pageIds = orderedIds.slice((page - 1) * limit, page * limit);
  const docs = await User.find({
    _id: { $in: pageIds.map((id) => new Types.ObjectId(id)) },
  }).lean();
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));

  const items = pageIds
    .map((id) => byId.get(id))
    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
    .map((doc) => withCommitment(doc, scores));

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Returns a paginated, filterable list of students for the admin panel.
 * Supports filtering by stage, isActive status, isSuspended status, a text
 * search across student phone and full name, and this month's commitment band.
 *
 * Every row carries its commitment score so the table can show the badge
 * whether or not the teacher is filtering by it.
 */
export async function listStudents(filter: ListUsersFilter = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
  const mongoFilter = buildStudentFilter(filter);

  if (filter.commitment) {
    return listStudentsByCommitment(
      mongoFilter,
      filter.commitment,
      page,
      limit,
    );
  }

  const [items, total] = await Promise.all([
    User.find(mongoFilter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(mongoFilter),
  ]);

  // Scored for the visible page only — the whole-platform pass is reserved for
  // the filtered path, where the ranking genuinely needs every student.
  const scores = await computeMonthlyCommitment(
    items.map((student) => student._id),
  );

  return {
    items: items.map((student) => withCommitment(student, scores)),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Returns full detail for a single student including their:
 *  - owned courses (active + revoked enrollments)
 *  - recent watch history (last 10 lessons)
 *  - active login sessions
 * Used by the admin "student detail" page.
 */
export async function getStudentDetail(studentId: string) {
  if (!Types.ObjectId.isValid(studentId)) {
    throw ApiError.notFound("الطالب غير موجود", "USER_NOT_FOUND");
  }

  const user = await User.findById(studentId);
  if (!user) throw ApiError.notFound("الطالب غير موجود", "USER_NOT_FOUND");

  const [enrollments, watchHistory, activeSessions] = await Promise.all([
    listEnrollmentsForUser(user._id),
    listProgressForUser(user._id),
    Session.find({
      userId: user._id,
      role: ROLES.STUDENT,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastActiveAt: -1 })
      .lean(),
  ]);

  return {
    user: user.toJSON(),
    enrollments,
    watchHistory,
    activeSessions: activeSessions.map((s) => ({
      _id: s._id,
      deviceLabel: s.deviceLabel,
      ipAddress: s.ipAddress,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    })),
  };
}

/**
 * Suspends or unsuspends a student account.
 * Suspended students are blocked at the auth middleware level on every request.
 */
export async function setSuspended(
  studentId: string,
  isSuspended: boolean,
): Promise<UserDocument> {
  const user = await User.findById(studentId);
  if (!user) throw ApiError.notFound("الطالب غير موجود", "USER_NOT_FOUND");

  user.isSuspended = isSuspended;
  await user.save();

  if (isSuspended) {
    await revokeAllUserSessions(user._id, ROLES.STUDENT, "ACCOUNT_SUSPENDED");
  }

  return user;
}

/**
 * Allows an admin to reset any student's password without knowing the old one.
 * Hashes the new password and saves it; the student's current sessions are NOT
 * revoked here (admin should revoke them manually if needed).
 */
export async function adminResetPassword(
  studentId: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(studentId).select("+passwordHash");
  if (!user) throw ApiError.notFound("الطالب غير موجود", "USER_NOT_FOUND");

  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  await revokeAllUserSessions(user._id, ROLES.STUDENT, "PASSWORD_RESET");
}

/**
 * Activates or deactivates a student account.
 * isActive=false blocks access even if the student has a valid subscription.
 * This is set to true automatically when the admin grants a subscription.
 */
export async function setActive(
  studentId: string,
  isActive: boolean,
): Promise<UserDocument> {
  const user = await User.findById(studentId);
  if (!user) throw ApiError.notFound("الطالب غير موجود", "USER_NOT_FOUND");
  user.isActive = isActive;
  await user.save();
  return user;
}

/**
 * Permanently deletes a student and EVERY record tied to them, in one go:
 * watch progress, course enrollments, login sessions, and any support
 * escalations raised for them — then the account itself. This is
 * irreversible and cannot be undone, so the admin UI gates it behind a
 * typed/explicit confirmation.
 *
 * Payments are intentionally KEPT: they are a financial record the teacher
 * may still need after the student is gone.
 *
 * Audit logs are intentionally NOT deleted: they are the teacher's own
 * immutable accountability trail ("granted course X to student Y"), not the
 * student's personal data, and a separate DELETE_USER entry is recorded for
 * the deletion itself. A returned snapshot (name + phone) lets the caller log
 * who was removed.
 */
export async function deleteStudentPermanently(
  studentId: string,
): Promise<{ deletedName: string; deletedPhone: string }> {
  if (!Types.ObjectId.isValid(studentId)) {
    throw ApiError.notFound("الطالب غير موجود", "USER_NOT_FOUND");
  }
  const user = await User.findById(studentId);
  if (!user) throw ApiError.notFound("الطالب غير موجود", "USER_NOT_FOUND");

  const userId = user._id;
  const deletedName =
    `${user.firstName} ${user.secondName} ${user.thirdName}`.trim();
  const deletedPhone = user.studentPhone;

  // Wipe all owned/related data first, then the account last, so a mid-way
  // failure never leaves a live account pointing at half-deleted data.
  await Promise.all([
    LessonProgress.deleteMany({ userId }),
    Enrollment.deleteMany({ userId }),
    Session.deleteMany({ userId, role: ROLES.STUDENT }),
    SupportEscalation.deleteMany({ studentId: userId }),
  ]);
  await User.deleteOne({ _id: userId });

  return { deletedName, deletedPhone };
}

/**
 * Applies one account-level action to a selected set of students. We keep the
 * existing single-student service methods as the source of truth, so a bulk
 * suspension still revokes sessions and a bulk deletion still removes the same
 * related records as its single-student counterpart.
 */
export async function applyBulkStudentAction(
  studentIds: string[],
  action: BulkStudentAction,
): Promise<BulkStudentActionResult> {
  const existing = await User.find({
    _id: { $in: studentIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("_id")
    .lean();

  const existingIds = new Set(existing.map((student) => String(student._id)));
  const missingIds = studentIds.filter((id) => !existingIds.has(id));
  const processedIds: string[] = [];
  const failedIds: string[] = [];
  const deletedSnapshots = new Map<
    string,
    { deletedName: string; deletedPhone: string }
  >();

  // Batches avoid overwhelming MongoDB with session revocations/deletions when
  // the teacher selects a large group, while still making the operation fast.
  const batchSize = 10;
  const idsToProcess = studentIds.filter((id) => existingIds.has(id));
  for (let start = 0; start < idsToProcess.length; start += batchSize) {
    const batch = idsToProcess.slice(start, start + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (studentId) => {
        if (action === "suspend") {
          await setSuspended(studentId, true);
          return { studentId };
        }
        if (action === "unsuspend") {
          await setSuspended(studentId, false);
          return { studentId };
        }

        const snapshot = await deleteStudentPermanently(studentId);
        return { studentId, snapshot };
      }),
    );

    settled.forEach((result, index) => {
      const studentId = batch[index];
      if (result.status === "rejected") {
        failedIds.push(studentId);
        return;
      }
      processedIds.push(studentId);
      if (result.value.snapshot) {
        deletedSnapshots.set(studentId, result.value.snapshot);
      }
    });
  }

  return { processedIds, missingIds, failedIds, deletedSnapshots };
}

export function isValidStage(value: unknown): value is Stage {
  return (
    typeof value === "string" && Object.values(STAGES).includes(value as Stage)
  );
}
