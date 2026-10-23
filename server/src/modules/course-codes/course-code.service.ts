import { randomInt } from "crypto";
import { nanoid } from "nanoid";
import { Types } from "mongoose";
import { CourseCode } from "./course-code.model";
import { Course } from "../courses/course.model";
import { User } from "../users/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { escapeRegex } from "../../shared/utils/regex";
import {
  ACCESS_DENIAL_REASONS,
  COURSE_CODE_STATUS,
  ENROLLMENT_SOURCE,
  type CourseCodeStatus,
} from "../../config/constants";
import {
  getActiveEnrollment,
  grantCourseAccess,
} from "../enrollments/enrollment.service";
import type {
  ExportCodesQuery,
  GenerateCodesInput,
  ListCodesQuery,
} from "./course-code.validation";

// ── Code format ───────────────────────────────────────────────────────────────
// 12 characters in three groups of four: "ABCD-EFGH-JKMN". The alphabet drops
// look-alikes (0/O, 1/I/L) so a printed code can't be misread, and gives
// 31^12 ≈ 8×10^17 combinations — guessing one is hopeless, even before the
// redeem rate limit.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;

function randomCode(): string {
  let raw = "";
  for (let i = 0; i < CODE_LENGTH; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

/**
 * What a student typed → the stored form, or null if it can't be a code.
 * Forgives spaces, dashes, lower case and Arabic-Indic digits (٢ → 2).
 */
export function normaliseCode(input: string): string | null {
  const raw = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (raw.length !== CODE_LENGTH) return null;
  if (![...raw].every((ch) => ALPHABET.includes(ch))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

// ── Admin ─────────────────────────────────────────────────────────────────────

/** Creates a batch of unique codes for one course. */
export async function generateCodes(
  input: GenerateCodesInput & { adminId: string },
) {
  const course = await Course.findById(input.courseId).select("title price");
  if (!course) throw ApiError.notFound("الكورس غير موجود", "COURSE_NOT_FOUND");

  const fresh = new Set<string>();
  while (fresh.size < input.count) fresh.add(randomCode());
  // A clash with an existing code is astronomically unlikely; replace any anyway.
  for (let round = 0; round < 3; round++) {
    const taken = await CourseCode.find({ code: { $in: [...fresh] } })
      .select("code")
      .lean();
    if (taken.length === 0) break;
    for (const { code } of taken) {
      fresh.delete(code);
      let next = randomCode();
      while (fresh.has(next)) next = randomCode();
      fresh.add(next);
    }
  }

  const batchId = nanoid(10);
  const price = input.price ?? course.price;
  const codes = [...fresh];
  await CourseCode.insertMany(
    codes.map((code) => ({
      code,
      courseId: course._id,
      batchId,
      batchLabel: input.label?.trim() || null,
      price,
      status: COURSE_CODE_STATUS.AVAILABLE,
      createdBy: new Types.ObjectId(input.adminId),
    })),
  );

  return {
    batchId,
    course: { id: String(course._id), title: course.title },
    price,
    label: input.label?.trim() || null,
    codes,
  };
}

interface PopulatedUser {
  _id: Types.ObjectId;
  firstName: string;
  secondName: string;
  thirdName: string;
  studentPhone: string;
}

export interface CourseCodeItem {
  id: string;
  code: string;
  status: CourseCodeStatus;
  price: number;
  batchId: string;
  batchLabel: string | null;
  createdAt: Date;
  usedAt: Date | null;
  usedBy: { id: string; name: string; studentPhone: string } | null;
}

async function buildFilter(query: {
  courseId: string;
  status?: string;
  batchId?: string;
  search?: string;
}) {
  const filter: Record<string, unknown> = {
    courseId: new Types.ObjectId(query.courseId),
  };
  if (query.status) filter.status = query.status;
  if (query.batchId) filter.batchId = query.batchId;
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), "i");
    const users = await User.find({
      $or: [
        { studentPhone: rx },
        { firstName: rx },
        { secondName: rx },
        { thirdName: rx },
      ],
    })
      .select("_id")
      .limit(200)
      .lean();
    filter.$or = [
      { code: new RegExp(escapeRegex(query.search.toUpperCase())) },
      { usedBy: { $in: users.map((u) => u._id) } },
    ];
  }
  return filter;
}

function toItem(doc: Record<string, unknown>): CourseCodeItem {
  const user = doc.usedBy as PopulatedUser | null;
  return {
    id: String(doc._id),
    code: doc.code as string,
    status: doc.status as CourseCodeStatus,
    price: doc.price as number,
    batchId: doc.batchId as string,
    batchLabel: (doc.batchLabel as string | null) ?? null,
    createdAt: doc.createdAt as Date,
    usedAt: (doc.usedAt as Date | null) ?? null,
    usedBy: user
      ? {
          id: String(user._id),
          name: `${user.firstName} ${user.secondName} ${user.thirdName}`.trim(),
          studentPhone: user.studentPhone,
        }
      : null,
  };
}

/** One course's codes (filtered, paged) + its totals and batches. */
export async function listCodes(query: ListCodesQuery) {
  const filter = await buildFilter(query);
  const courseId = new Types.ObjectId(query.courseId);

  const [docs, total, byStatus, batches] = await Promise.all([
    CourseCode.find(filter)
      .sort({ createdAt: -1, code: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate("usedBy", "firstName secondName thirdName studentPhone")
      .lean(),
    CourseCode.countDocuments(filter),
    CourseCode.aggregate<{ _id: CourseCodeStatus; count: number }>([
      { $match: { courseId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    CourseCode.aggregate<{
      _id: string;
      label: string | null;
      total: number;
      used: number;
      price: number;
      createdAt: Date;
    }>([
      { $match: { courseId } },
      {
        $group: {
          _id: "$batchId",
          label: { $first: "$batchLabel" },
          price: { $first: "$price" },
          total: { $sum: 1 },
          used: {
            $sum: { $cond: [{ $eq: ["$status", COURSE_CODE_STATUS.USED] }, 1, 0] },
          },
          createdAt: { $min: "$createdAt" },
        },
      },
      { $sort: { createdAt: -1 } },
    ]),
  ]);

  const count = (status: CourseCodeStatus) =>
    byStatus.find((row) => row._id === status)?.count ?? 0;
  const counts = {
    available: count(COURSE_CODE_STATUS.AVAILABLE),
    used: count(COURSE_CODE_STATUS.USED),
    disabled: count(COURSE_CODE_STATUS.DISABLED),
  };

  return {
    items: docs.map((doc) => toItem(doc as unknown as Record<string, unknown>)),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
    counts: { ...counts, total: counts.available + counts.used + counts.disabled },
    batches: batches.map((b) => ({
      batchId: b._id,
      label: b.label,
      price: b.price,
      total: b.total,
      used: b.used,
      createdAt: b.createdAt,
    })),
  };
}

/** Every code matching the filters (for the CSV / print sheet). */
export async function listCodesForExport(query: ExportCodesQuery) {
  const filter = await buildFilter(query);
  const [course, docs] = await Promise.all([
    Course.findById(query.courseId).select("title").lean(),
    CourseCode.find(filter)
      .sort({ createdAt: -1, code: 1 })
      .limit(5000)
      .populate("usedBy", "firstName secondName thirdName studentPhone")
      .lean(),
  ]);
  return {
    courseTitle: course?.title ?? "",
    items: docs.map((doc) => toItem(doc as unknown as Record<string, unknown>)),
  };
}

/**
 * Switches an unused code off (lost / not to be sold) or back on. One
 * conditional write: a student redeeming the code at that same moment can't
 * have it turned back to "available" — and sold a second time.
 */
export async function setCodeDisabled(id: string, disabled: boolean) {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.notFound("الكود غير موجود", "CODE_NOT_FOUND");
  }
  const code = await CourseCode.findOneAndUpdate(
    { _id: id, status: { $ne: COURSE_CODE_STATUS.USED } },
    {
      $set: {
        status: disabled
          ? COURSE_CODE_STATUS.DISABLED
          : COURSE_CODE_STATUS.AVAILABLE,
      },
    },
    { new: true },
  );
  if (!code) {
    if (!(await CourseCode.exists({ _id: id }))) {
      throw ApiError.notFound("الكود غير موجود", "CODE_NOT_FOUND");
    }
    throw ApiError.conflict(
      "الكود ده اتستخدم خلاص، مينفعش يتوقف أو يتفعّل.",
      "CODE_ALREADY_USED",
    );
  }
  return { id: String(code._id), code: code.code, courseId: code.courseId, status: code.status };
}

/**
 * Removes codes for good: they stop working and leave the lists, as if never
 * made. A student who already used one keeps the course — the enrollment
 * (and the sale it recorded) is separate from the code.
 */
export async function deleteCodes(ids: string[]) {
  const docs = await CourseCode.find({ _id: { $in: ids } })
    .select("code courseId")
    .lean();
  if (docs.length === 0) {
    throw ApiError.notFound("الأكواد دي مش موجودة", "CODE_NOT_FOUND");
  }
  const { deletedCount } = await CourseCode.deleteMany({
    _id: { $in: docs.map((d) => d._id) },
  });
  const courseIds = [...new Set(docs.map((d) => String(d.courseId)))];
  return {
    deleted: deletedCount,
    codes: docs.map((d) => d.code),
    courseId: courseIds.length === 1 ? docs[0].courseId : null,
  };
}

// ── Student ───────────────────────────────────────────────────────────────────

/**
 * Opens the code's course for the student. The same rules as buying apply
 * (published course, the student's own stage, not already owned) and are all
 * checked BEFORE the code is spent, so a code is never wasted on a refusal.
 * The code is then claimed atomically — two students racing with one code
 * can't both get the course — and released again if the grant fails.
 */
export async function redeemCode(input: {
  userId: string;
  code: string;
  /** The course page it was typed on; a code for another course is refused (and kept). */
  courseId?: string;
}) {
  const normalised = normaliseCode(input.code);
  if (!normalised) {
    throw ApiError.badRequest(
      "الكود مكتوب غلط. الكود 12 حرف ورقم، زي: ABCD-EFGH-JKMN",
      "INVALID_CODE_FORMAT",
    );
  }

  const found = await CourseCode.findOne({ code: normalised });
  if (!found || found.status === COURSE_CODE_STATUS.DISABLED) {
    throw ApiError.notFound(
      "الكود ده مش صحيح. اتأكد منه وجرّب تاني.",
      "CODE_NOT_FOUND",
    );
  }
  if (found.status === COURSE_CODE_STATUS.USED) {
    if (found.usedBy && String(found.usedBy) === input.userId) {
      throw ApiError.conflict(
        "إنت فعّلت الكود ده قبل كده، والكورس مفتوح عندك.",
        "CODE_ALREADY_REDEEMED_BY_YOU",
      );
    }
    throw ApiError.conflict("الكود ده اتستخدم قبل كده.", "CODE_ALREADY_USED");
  }

  const [user, course] = await Promise.all([
    User.findById(input.userId).select("stage").lean(),
    Course.findById(found.courseId).select("title slug stage isPublished"),
  ]);
  if (!user) throw ApiError.unauthorized("المستخدم غير موجود", "USER_NOT_FOUND");
  if (!course || !course.isPublished) {
    throw ApiError.notFound(
      "الكورس بتاع الكود ده مش متاح دلوقتي. كلّم المستر.",
      "COURSE_NOT_AVAILABLE",
    );
  }
  if (input.courseId && String(course._id) !== input.courseId) {
    throw ApiError.badRequest(
      `الكود ده مخصص لكورس «${course.title}»، مش للكورس ده.`,
      "CODE_FOR_ANOTHER_COURSE",
    );
  }
  if (course.stage !== user.stage) {
    throw ApiError.forbidden(
      `الكود ده لكورس «${course.title}» وهو مش لمرحلتك الدراسية.`,
      ACCESS_DENIAL_REASONS.STAGE_MISMATCH,
    );
  }
  if (await getActiveEnrollment(input.userId, course._id)) {
    throw ApiError.conflict(
      `إنت مشترك في كورس «${course.title}» بالفعل. الكود لسه سليم ومحدش استخدمه.`,
      "ALREADY_OWNED",
    );
  }

  const claimed = await CourseCode.findOneAndUpdate(
    { _id: found._id, status: COURSE_CODE_STATUS.AVAILABLE },
    {
      $set: {
        status: COURSE_CODE_STATUS.USED,
        usedBy: new Types.ObjectId(input.userId),
        usedAt: new Date(),
      },
    },
    { new: true },
  );
  if (!claimed) {
    throw ApiError.conflict("الكود ده اتستخدم قبل كده.", "CODE_ALREADY_USED");
  }

  try {
    await grantCourseAccess({
      userId: input.userId,
      courseId: course._id,
      source: ENROLLMENT_SOURCE.CODE,
      amountPaid: claimed.price,
      notes: `كود ${claimed.code}`,
      stage: course.stage,
    });
  } catch (err) {
    await CourseCode.updateOne(
      { _id: claimed._id, usedBy: claimed.usedBy },
      {
        $set: {
          status: COURSE_CODE_STATUS.AVAILABLE,
          usedBy: null,
          usedAt: null,
        },
      },
    );
    throw err;
  }

  return {
    course: { id: String(course._id), title: course.title, slug: course.slug },
  };
}
