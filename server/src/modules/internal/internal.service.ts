import { Types } from "mongoose";
import { User } from "../users/user.model";
import { LessonProgress } from "../progress/progress.model";
import { Lesson } from "../lessons/lesson.model";
import { Enrollment } from "../enrollments/enrollment.model";
import { Course } from "../courses/course.model";
import { logger } from "../../shared/utils/logger";
import { env } from "../../config/env";
import { ENROLLMENT_STATUS, ENROLLMENT_SOURCE } from "../../config/constants";
import { sendParentDigestTemplate } from "../notifications/whatsapp.client";

/**
 * All the "read a stat" and "who is lagging" queries that n8n calls when it
 * needs data from the platform. Everything is scoped to the single teacher
 * (env.PLATFORM_TEACHER_ID) because this platform is single-tenant right now —
 * a call with a different teacher_id returns empty/zero.
 */

function isMatchingTeacher(teacherId: string): boolean {
  // Constant-time'ish equality — good enough here since teacher_id is not a secret.
  return teacherId === env.PLATFORM_TEACHER_ID;
}

// ── Stat queries ───────────────────────────────────────────────────────────────

/**
 * Union type of the shapes ai-stats can return. Kept intentionally loose so
 * the controller can pass whatever the WF5 branch produced without a huge
 * discriminated-union ceremony.
 */
export type AiStatsResult = Record<string, unknown>;

/**
 * Dispatches on query_type. Each branch does one focused aggregation.
 * A wrong or unknown type returns `{ error: "UNSUPPORTED_QUERY_TYPE" }`.
 */
export async function getAiStats(
  type: string,
  teacherId: string,
  paramsRaw: string,
): Promise<AiStatsResult> {
  if (!isMatchingTeacher(teacherId)) {
    // For a foreign teacher_id, return empty — never leak that the teacher does not exist.
    return { total: 0, items: [] };
  }

  let params: Record<string, unknown> = {};
  try {
    if (paramsRaw && paramsRaw !== "{}") {
      params = JSON.parse(paramsRaw);
    }
  } catch {
    // Malformed params — treat as no params, don't crash.
    params = {};
  }

  switch (type) {
    case "active_students":
      return statActiveStudents();
    case "at_risk_students":
      return statAtRiskStudents(params);
    case "lesson_completion":
      return statLessonCompletion(params);
    case "top_performers":
      return statTopPerformers(params);
    case "recent_signups":
      return statRecentSignups(params);
    case "sales_summary":
      return statSalesSummary();
    case "student_detail":
      return statStudentDetail(params);
    default:
      return { error: "UNSUPPORTED_QUERY_TYPE" };
  }
}

async function statActiveStudents(): Promise<AiStatsResult> {
  // Buy-course model: an "active" student is one who OWNS at least one course
  // (an active enrollment). There is no subscription concept any more.
  const totalRegistered = await User.countDocuments({ isSuspended: false });
  const activated = await User.countDocuments({
    isSuspended: false,
    isActive: true,
  });

  const ownerIds = await Enrollment.distinct("userId", {
    status: ENROLLMENT_STATUS.ACTIVE,
  });

  return {
    total_registered: totalRegistered,
    total_activated: activated,
    total_students_with_courses: ownerIds.length,
  };
}

async function statAtRiskStudents(
  params: Record<string, unknown>,
): Promise<AiStatsResult> {
  // "At risk" = active subscriber who has NOT watched any lesson in N days (default 14).
  const daysThreshold = normalizePositiveInt(params.days_threshold, 14, 1, 90);
  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

  // 1) All students who OWN at least one active course.
  const activeSubUserIds = (await Enrollment.distinct("userId", {
    status: ENROLLMENT_STATUS.ACTIVE,
  })) as Types.ObjectId[];

  if (activeSubUserIds.length === 0) {
    return { days_threshold: daysThreshold, total: 0, items: [] };
  }

  // 2) Of those, who has a max lastWatchedAt older than cutoff (or no progress at all).
  const recentActivity = await LessonProgress.aggregate<{
    _id: Types.ObjectId;
    lastActiveAt: Date;
  }>([
    { $match: { userId: { $in: activeSubUserIds } } },
    { $group: { _id: "$userId", lastActiveAt: { $max: "$lastWatchedAt" } } },
  ]);

  const lastActiveByUser = new Map<string, Date>(
    recentActivity.map((r) => [String(r._id), r.lastActiveAt]),
  );

  // Compare each subscriber's last activity to the cutoff.
  const atRiskIds = activeSubUserIds.filter((uid) => {
    const last = lastActiveByUser.get(String(uid));
    return !last || last < cutoff;
  });

  const users = await User.find({ _id: { $in: atRiskIds } })
    .select("firstName secondName thirdName stage parentPhone studentPhone")
    .lean();

  return {
    days_threshold: daysThreshold,
    total: users.length,
    items: users.map((u) => ({
      student_id: String(u._id),
      name: `${u.firstName} ${u.secondName} ${u.thirdName}`.trim(),
      stage: u.stage,
      last_active_at: lastActiveByUser.get(String(u._id)) ?? null,
    })),
  };
}

async function statLessonCompletion(
  params: Record<string, unknown>,
): Promise<AiStatsResult> {
  const lessonId = typeof params.lesson_id === "string" ? params.lesson_id : null;
  const match: Record<string, unknown> = {};
  if (lessonId && Types.ObjectId.isValid(lessonId)) {
    match.lessonId = new Types.ObjectId(lessonId);
  }
  const [agg] = await LessonProgress.aggregate<{ _id: null; total: number; completed: number; avg_pct: number }>([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: ["$isCompleted", 1, 0] } },
        avg_pct: { $avg: "$watchedPercentage" },
      },
    },
  ]);
  return {
    lesson_id: lessonId,
    total_records: agg?.total ?? 0,
    completed_records: agg?.completed ?? 0,
    average_percentage: Math.round((agg?.avg_pct ?? 0) * 10) / 10,
  };
}

async function statTopPerformers(
  params: Record<string, unknown>,
): Promise<AiStatsResult> {
  const limit = normalizePositiveInt(params.limit, 10, 1, 50);
  const top = await LessonProgress.aggregate<{
    _id: Types.ObjectId;
    completed_count: number;
    total_percentage: number;
  }>([
    {
      $group: {
        _id: "$userId",
        completed_count: { $sum: { $cond: ["$isCompleted", 1, 0] } },
        total_percentage: { $sum: "$watchedPercentage" },
      },
    },
    { $sort: { completed_count: -1, total_percentage: -1 } },
    { $limit: limit },
  ]);
  const ids = top.map((t) => t._id);
  const users = await User.find({ _id: { $in: ids } })
    .select("firstName secondName thirdName stage")
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return {
    limit,
    items: top.map((t) => {
      const u = byId.get(String(t._id));
      return {
        student_id: String(t._id),
        name: u
          ? `${u.firstName} ${u.secondName} ${u.thirdName}`.trim()
          : null,
        stage: u?.stage ?? null,
        completed_lessons: t.completed_count,
      };
    }),
  };
}

async function statRecentSignups(
  params: Record<string, unknown>,
): Promise<AiStatsResult> {
  const days = normalizePositiveInt(params.days, 7, 1, 90);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const total = await User.countDocuments({ createdAt: { $gte: cutoff } });
  const items = await User.find({ createdAt: { $gte: cutoff } })
    .select("firstName secondName thirdName stage createdAt isActive")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  return {
    days,
    total,
    items: items.map((u) => ({
      student_id: String(u._id),
      name: `${u.firstName} ${u.secondName} ${u.thirdName}`.trim(),
      stage: u.stage,
      created_at: u.createdAt,
      is_active: u.isActive,
    })),
  };
}

async function statSalesSummary(): Promise<AiStatsResult> {
  // Buy-course model: summarise course ownership + revenue. Access never
  // expires once bought, so there is nothing "expiring" to report.
  const [agg] = await Enrollment.aggregate<{
    _id: null;
    active_enrollments: number;
    total_revenue: number;
    paid_online: number;
    cash: number;
    code: number;
  }>([
    { $match: { status: ENROLLMENT_STATUS.ACTIVE } },
    {
      $group: {
        _id: null,
        active_enrollments: { $sum: 1 },
        total_revenue: { $sum: "$amountPaid" },
        paid_online: {
          $sum: { $cond: [{ $eq: ["$source", ENROLLMENT_SOURCE.PAYMOB] }, 1, 0] },
        },
        cash: {
          $sum: { $cond: [{ $eq: ["$source", ENROLLMENT_SOURCE.CASH] }, 1, 0] },
        },
        code: {
          $sum: { $cond: [{ $eq: ["$source", ENROLLMENT_SOURCE.CODE] }, 1, 0] },
        },
      },
    },
  ]);
  return {
    active_enrollments: agg?.active_enrollments ?? 0,
    total_revenue_egp: agg?.total_revenue ?? 0,
    courses_sold_online: agg?.paid_online ?? 0,
    courses_opened_cash: agg?.cash ?? 0,
    courses_opened_by_code: agg?.code ?? 0,
  };
}
// ── Individual student lookup (teacher-facing) ────────────────────────────────

/**
 * Escapes a user-supplied string so it can be embedded in a RegExp literally.
 * The teacher types a name in free text and the AI forwards it verbatim, so
 * without this a stray "(" or "*" would either throw or match far too much.
 */
function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Arabic spellings that should be treated as the same letter when matching a
 * name. A teacher types "ساره" on Monday and "سارة" on Tuesday and means the
 * same girl, so both sides of the comparison get folded to one canonical form
 * before any regex runs. Also strips tatweel and the harakat, which nobody
 * types consistently.
 */
const ARABIC_FOLDINGS: ReadonlyArray<readonly [string, string]> = [
  ["\u0623", "\u0627"], // أ -> ا
  ["\u0625", "\u0627"], // إ -> ا
  ["\u0622", "\u0627"], // آ -> ا
  ["\u0671", "\u0627"], // ٱ -> ا
  ["\u0629", "\u0647"], // ة -> ه
  ["\u0649", "\u064a"], // ى -> ي
  ["\u0624", "\u0648"], // ؤ -> و
  ["\u0626", "\u064a"], // ئ -> ي
  ["\u0640", ""],  // tatweel
  ["\u064b", ""],
  ["\u064c", ""],
  ["\u064d", ""],
  ["\u064e", ""],
  ["\u064f", ""],
  ["\u0650", ""],
  ["\u0651", ""],
  ["\u0652", ""],
];

/** Applies ARABIC_FOLDINGS to a string here in Node (the query side). */
function foldArabic(raw: string): string {
  return ARABIC_FOLDINGS.reduce(
    (acc, [from, to]) => acc.split(from).join(to),
    raw,
  );
}

/**
 * Builds the equivalent nested $replaceAll expression so Mongo folds the
 * STORED names exactly the same way. Both sides must use the same list or the
 * folding silently only half-works.
 */
function foldArabicExpr(input: unknown): unknown {
  return ARABIC_FOLDINGS.reduce<unknown>(
    (expr, [from, to]) => ({
      $replaceAll: { input: expr, find: from, replacement: to },
    }),
    input,
  );
}

/**
 * Looks up ONE student — by name, id, or phone — and returns their full
 * progress picture: every lesson they opened, how far they got in each, how
 * many are finished, their subscription state, and how recently they showed up.
 *
 * The teacher chat AI calls this whenever the teacher asks about a specific
 * student ("عامل ايه محمد هاني؟", "الدروس اللي شافها سارة إيه؟"). Name search
 * is deliberately forgiving — the teacher will type two words out of a
 * three-part name, in any order, in Arabic or English — so every
 * whitespace-separated token must appear SOMEWHERE in the student's full name,
 * case-insensitively.
 *
 * Three distinct outcomes, each explicitly labelled so the AI reacts correctly
 * instead of guessing:
 *   found:false + NO_MATCH         → nobody by that name
 *   found:false + MULTIPLE_MATCHES → ambiguous; the shortlist is returned
 *   found:true                     → the full detail payload
 */
async function statStudentDetail(
  params: Record<string, unknown>,
): Promise<AiStatsResult> {
  const rawId =
    typeof params.student_id === "string" ? params.student_id.trim() : "";
  const rawName = typeof params.name === "string" ? params.name.trim() : "";
  const rawPhone = typeof params.phone === "string" ? params.phone.trim() : "";

  let userId: Types.ObjectId | null = null;

  if (rawId && Types.ObjectId.isValid(rawId)) {
    userId = new Types.ObjectId(rawId);
  } else if (rawPhone) {
    const byPhone = await User.findOne({ studentPhone: rawPhone })
      .select("_id")
      .lean();
    if (!byPhone) {
      return {
        found: false,
        reason: "NO_MATCH",
        searched_for: rawPhone,
        message: "No student on this platform has that phone number.",
      };
    }
    userId = byPhone._id as Types.ObjectId;
  } else if (rawName) {
    const tokens = rawName.split(/\s+/).filter(Boolean).slice(0, 5);
    const candidates = await User.aggregate<{
      _id: Types.ObjectId;
      full_name: string;
      stage: string;
    }>([
      {
        $addFields: {
          full_name: {
            $concat: ["$firstName", " ", "$secondName", " ", "$thirdName"],
          },
        },
      },
      // match_name is the folded copy we search against; full_name stays
      // untouched so the teacher sees the name spelled the way it was entered.
      { $addFields: { match_name: foldArabicExpr("$full_name") } },
      {
        $match: {
          $and: tokens.map((t) => ({
            match_name: { $regex: escapeRegex(foldArabic(t)), $options: "i" },
          })),
        },
      },
      { $limit: 10 },
      { $project: { full_name: 1, stage: 1 } },
    ]);

    if (candidates.length === 0) {
      return {
        found: false,
        reason: "NO_MATCH",
        searched_for: rawName,
        message: "No student registered on this platform matches that name.",
      };
    }
    if (candidates.length > 1) {
      // Ambiguous on purpose — hand back the shortlist rather than picking one,
      // so the AI asks the teacher which student he means instead of
      // confidently reporting the wrong child's numbers.
      return {
        found: false,
        reason: "MULTIPLE_MATCHES",
        searched_for: rawName,
        total: candidates.length,
        candidates: candidates.map((c) => ({
          student_id: String(c._id),
          name: c.full_name.trim(),
          stage: c.stage,
        })),
        message:
          "More than one student matches that name — ask the teacher which one, then call again with that student_id.",
      };
    }
    userId = candidates[0]._id;
  }

  if (!userId) {
    return {
      found: false,
      reason: "MISSING_IDENTIFIER",
      message: "Provide params_json with one of: name, student_id, or phone.",
    };
  }

  return buildStudentDetail(userId);
}

/**
 * Assembles the full teacher-facing progress report for one already-resolved
 * student. Split out from statStudentDetail so the "which student?" logic and
 * the "what about them?" logic stay independently readable.
 */
async function buildStudentDetail(
  userId: Types.ObjectId,
): Promise<AiStatsResult> {
  const user = await User.findById(userId)
    .select(
      "firstName secondName thirdName stage isActive isSuspended createdAt lastLoginAt",
    )
    .lean();

  if (!user) {
    return {
      found: false,
      reason: "NO_MATCH",
      message: "That student no longer exists on this platform.",
    };
  }

  const now = new Date();

  const ownedCourses = await Enrollment.find({
    userId,
    status: ENROLLMENT_STATUS.ACTIVE,
  })
    .populate<{ courseId: { title: string } | null }>("courseId", "title")
    .lean();

  // Published lessons for THIS student's stage — the denominator that makes
  // "finished 8 lessons" mean something.
  const totalLessons = await Lesson.countDocuments({
    stage: user.stage,
    isPublished: true,
  });

  const progressRows = await LessonProgress.find({ userId })
    .sort({ lastWatchedAt: -1 })
    .populate<{ lessonId: { title: string } | null }>("lessonId", "title")
    .lean();

  const completedCount = progressRows.filter((r) => r.isCompleted).length;
  const totalSeconds = progressRows.reduce(
    (sum, r) => sum + (r.lastWatchedSecond ?? 0),
    0,
  );
  const lastActive = progressRows.length
    ? progressRows
        .map((r) => r.lastWatchedAt)
        .reduce((a, b) => (a > b ? a : b))
    : null;

  const daysSinceActive = lastActive
    ? Math.floor((now.getTime() - lastActive.getTime()) / 86400000)
    : null;

  // Distinct calendar days with any watching in the last 30 — a cheap
  // engagement signal the teacher actually cares about.
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const activeDaysLast30 = new Set(
    progressRows
      .filter((r) => r.lastWatchedAt >= thirtyDaysAgo)
      .map((r) => r.lastWatchedAt.toISOString().slice(0, 10)),
  ).size;

  return {
    found: true,
    student_id: String(user._id),
    name: `${user.firstName} ${user.secondName} ${user.thirdName}`.trim(),
    stage: user.stage,
    account_status: user.isSuspended
      ? "suspended"
      : user.isActive
        ? "active"
        : "not_activated",
    joined_at: user.createdAt,
    last_login_at: user.lastLoginAt,
    owned_courses: {
      count: ownedCourses.length,
      titles: ownedCourses
        .map((e) => (e.courseId as { title?: string } | null)?.title)
        .filter((t): t is string => !!t),
    },
    progress: {
      total_lessons_available: totalLessons,
      lessons_started: progressRows.length,
      lessons_completed: completedCount,
      completion_percentage:
        totalLessons > 0
          ? Math.round((completedCount / totalLessons) * 1000) / 10
          : 0,
      total_watch_minutes: Math.round(totalSeconds / 60),
      last_active_at: lastActive,
      days_since_last_activity: daysSinceActive,
      active_days_last_30: activeDaysLast30,
    },
    // Every lesson the student has opened, newest first. Capped so a very
    // active student can't blow out the AI's context window.
    lessons: progressRows.slice(0, 30).map((r) => ({
      lesson_title:
        (r.lessonId as { title?: string } | null)?.title ?? "درس محذوف",
      watched_percentage: Math.round(r.watchedPercentage),
      is_completed: r.isCompleted,
      last_watched_at: r.lastWatchedAt,
    })),
    lessons_truncated: progressRows.length > 30,
  };
}

// ── Weekly "behind on lessons" digest (course-ownership model) ──────────

/**
 * Default grace period, in days. A lesson counts as "behind" only after BOTH
 * windows have passed: at least this many days since the lesson was PUBLISHED
 * (Lesson.publishedAt), AND at least this many days since the student BOUGHT
 * the course (Enrollment.grantedAt — the latest purchase, or createdAt for
 * older records). So a freshly published lesson, and a
 * course a student only just bought, are both given the full grace period
 * before the parent is ever notified.
 */
export const BEHIND_LESSON_DAYS_DEFAULT = 5;

/**
 * A lesson watched below this percentage is treated as "never really opened".
 * Between this and env.LESSON_COMPLETION_THRESHOLD the student opened it but
 * did not finish it. At/above the completion threshold the lesson is done and
 * is NOT reported.
 */
const OPENED_MIN_PERCENT = 10;

export type BehindLessonStatus = "not_opened" | "not_completed";

export interface BehindLesson {
  lesson_id: string;
  lesson_title: string;
  watched_percentage: number;
  status: BehindLessonStatus;
}

export interface BehindStudent {
  student_id: string;
  parent_id: string;
  teacher_id: string;
  student_name: string;
  behind_count: number;
  behind_lessons: BehindLesson[];
  parent_consent: boolean;
}

export interface WeeklyBehindDigest {
  platform_name: string;
  teacher_id: string;
  days_threshold: number;
  students: StudentReport[];
}

/**
 * Classifies one lesson for one student given the student's progress row.
 * Returns null when the lesson is finished (so it should NOT be reported).
 */
function classifyBehindLesson(
  lessonId: string,
  lessonTitle: string,
  watchedPercentageRaw: number | undefined,
  isCompleted: boolean | undefined,
): BehindLesson | null {
  const pct = typeof watchedPercentageRaw === "number" ? Math.round(watchedPercentageRaw) : 0;
  const done = isCompleted === true || pct >= env.LESSON_COMPLETION_THRESHOLD;
  if (done) return null;
  return {
    lesson_id: lessonId,
    lesson_title: lessonTitle,
    watched_percentage: pct,
    status: pct < OPENED_MIN_PERCENT ? "not_opened" : "not_completed",
  };
}

/**
 * Computes the behind-lesson list for ONE student. Used by notifyParent as the
 * single source of truth right before sending, so the message never trusts a
 * list passed in from n8n.
 *
 * A lesson is a candidate only when: the student actively owns its course,
 * has owned it for at least `daysThreshold` days (grace period from purchase),
 * AND the lesson is published and was published at least `daysThreshold` days
 * ago. Of those, a lesson is "behind" when it is not completed.
 */
export async function computeBehindLessonsForStudent(
  userId: Types.ObjectId,
  daysThreshold: number,
): Promise<BehindLesson[]> {
  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

  const enrollments = await Enrollment.find({
    userId,
    status: ENROLLMENT_STATUS.ACTIVE,
  })
    .select("courseId grantedAt createdAt")
    .lean();
  if (enrollments.length === 0) return [];
  // Only courses the student has OWNED for at least `daysThreshold` days: a
  // freshly bought course is still in its grace period, so none of its lessons
  // can be "behind" yet — no matter how old those lessons are.
  const matureCourseIds = enrollments
    .filter((e) => {
      const since = e.grantedAt ?? e.createdAt;
      return since && new Date(since) <= cutoff;
    })
    .map((e) => e.courseId);
  if (matureCourseIds.length === 0) return [];

  const lessons = await Lesson.find({
    courseId: { $in: matureCourseIds },
    isPublished: true,
    publishedAt: { $ne: null, $lte: cutoff },
  })
    .select("_id title")
    .lean();
  if (lessons.length === 0) return [];
  const lessonIds = lessons.map((l) => l._id);

  const progressRows = await LessonProgress.find({
    userId,
    lessonId: { $in: lessonIds },
  })
    .select("lessonId watchedPercentage isCompleted")
    .lean();
  const byLesson = new Map(progressRows.map((p) => [String(p.lessonId), p]));

  const behind: BehindLesson[] = [];
  for (const l of lessons) {
    const p = byLesson.get(String(l._id));
    const cls = classifyBehindLesson(
      String(l._id),
      l.title,
      p?.watchedPercentage,
      p?.isCompleted,
    );
    if (cls) behind.push(cls);
  }
  return behind;
}

// ── Weekly progress report (post-enrollment lessons only) ──────────────

export interface ReportLesson {
  lesson_id: string;
  lesson_title: string;
}

/** One owned course, grouped into the three states parents need to see. */
export interface ParentCourseProgress {
  course_id: string;
  course_title: string;
  completed_lessons: ReportLesson[];
  in_progress_lessons: ReportLesson[];
  not_started_lessons: ReportLesson[];
}

export interface StudentReport {
  student_id: string;
  parent_id: string;
  teacher_id: string;
  student_name: string;
  watched_lessons: ReportLesson[];
  missed_lessons: ReportLesson[];
  parent_consent: boolean;
}

/** A lesson counts as finished at/above the completion threshold. */
function isLessonFinished(
  watchedPercentageRaw: number | undefined,
  isCompleted: boolean | undefined,
): boolean {
  const pct = typeof watchedPercentageRaw === "number" ? watchedPercentageRaw : 0;
  return isCompleted === true || pct >= env.LESSON_COMPLETION_THRESHOLD;
}

/**
 * Computes ONE student's parent-facing progress report from all published
 * lessons in courses they actively own. The weekly workflow still decides WHEN
 * to send a report; this function decides HOW the current progress is shown.
 */
export async function computeStudentReport(
  userId: Types.ObjectId,
): Promise<ParentCourseProgress[]> {
  const enrollments = await Enrollment.find({
    userId,
    status: ENROLLMENT_STATUS.ACTIVE,
  })
    .select("courseId")
    .lean();
  if (enrollments.length === 0) return [];

  const courseIds = [
    ...new Set(enrollments.map((e) => String(e.courseId))),
  ].map((id) => new Types.ObjectId(id));
  if (courseIds.length === 0) return [];

  const [courses, lessons] = await Promise.all([
    Course.find({ _id: { $in: courseIds } })
      .select("title")
      .lean(),
    Lesson.find({
      courseId: { $in: courseIds },
      isPublished: true,
      publishedAt: { $ne: null },
    })
      .select("_id title courseId order")
      .sort({ courseId: 1, order: 1, _id: 1 })
      .lean(),
  ]);
  if (lessons.length === 0) return [];

  const courseTitleById = new Map(
    courses.map((course) => [String(course._id), course.title]),
  );
  const lessonsByCourse = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const courseId = String(lesson.courseId);
    const group = lessonsByCourse.get(courseId) ?? [];
    group.push(lesson);
    lessonsByCourse.set(courseId, group);
  }

  const progressRows = await LessonProgress.find({
    userId,
    lessonId: { $in: lessons.map((l) => l._id) },
  })
    .select("lessonId watchedPercentage isCompleted")
    .lean();
  const byLesson = new Map(progressRows.map((pr) => [String(pr.lessonId), pr]));

  const report: ParentCourseProgress[] = [];
  for (const courseId of courseIds.map(String)) {
    const courseTitle = courseTitleById.get(courseId);
    const courseLessons = lessonsByCourse.get(courseId);
    if (!courseTitle || !courseLessons?.length) continue;

    const completed_lessons: ReportLesson[] = [];
    const in_progress_lessons: ReportLesson[] = [];
    const not_started_lessons: ReportLesson[] = [];

    for (const lesson of courseLessons) {
      const progress = byLesson.get(String(lesson._id));
      const entry: ReportLesson = {
        lesson_id: String(lesson._id),
        lesson_title: lesson.title,
      };
      if (
        isLessonFinished(progress?.watchedPercentage, progress?.isCompleted)
      ) {
        completed_lessons.push(entry);
      } else if ((progress?.watchedPercentage ?? 0) > 0) {
        in_progress_lessons.push(entry);
      } else {
        not_started_lessons.push(entry);
      }
    }

    report.push({
      course_id: courseId,
      course_title: courseTitle,
      completed_lessons,
      in_progress_lessons,
      not_started_lessons,
    });
  }

  return report;
}

/**
 * Builds the full weekly digest: every active, non-suspended student who has at
 * least one lesson in an actively owned course to report on (watched or missed),
 * with those lists. WF12 calls this once per platform, dedups against
 * notificationsLog, and hands each student to WF8 -> notifyParent (which
 * re-computes before sending).
 *
 * Done in a handful of bulk queries (not per-student) since it runs weekly over
 * the whole platform.
 */
export async function getWeeklyBehindDigest(
  daysThreshold: number,
): Promise<WeeklyBehindDigest> {
  const empty: WeeklyBehindDigest = {
    platform_name: env.PLATFORM_NAME ?? "",
    teacher_id: env.PLATFORM_TEACHER_ID,
    days_threshold: daysThreshold,
    students: [],
  };

  const matureCutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

  // 1) All active ownership records — keep the enrollment date per (user, course).
  const activeEnrollments = await Enrollment.find({
    status: ENROLLMENT_STATUS.ACTIVE,
  })
    .select("userId courseId grantedAt createdAt")
    .lean();
  if (activeEnrollments.length === 0) return empty;

  const enrolledAt = new Map<string, Date>(); // "uid|cid" -> enrollment date
  const coursesByUser = new Map<string, Set<string>>();
  const courseIdSet = new Set<string>();
  const ownerIdSet = new Set<string>();
  for (const e of activeEnrollments) {
    const since = e.grantedAt ?? e.createdAt;
    if (!since) continue;
    const uid = String(e.userId);
    const cid = String(e.courseId);
    enrolledAt.set(`${uid}|${cid}`, new Date(since));
    const set = coursesByUser.get(uid) ?? new Set<string>();
    set.add(cid);
    coursesByUser.set(uid, set);
    courseIdSet.add(cid);
    ownerIdSet.add(uid);
  }
  if (courseIdSet.size === 0) return empty;

  // 2) All published lessons in those courses (matured or not — we need both to
  // tell "watched" from "missed").
  const lessons = await Lesson.find({
    courseId: { $in: [...courseIdSet].map((id) => new Types.ObjectId(id)) },
    isPublished: true,
    publishedAt: { $ne: null },
  })
    .select("_id title courseId publishedAt")
    .lean();
  if (lessons.length === 0) return empty;

  const lessonsByCourse = new Map<
    string,
    Array<{ id: string; title: string; publishedAt: Date }>
  >();
  for (const l of lessons) {
    if (!l.publishedAt) continue;
    const key = String(l.courseId);
    const arr = lessonsByCourse.get(key) ?? [];
    arr.push({ id: String(l._id), title: l.title, publishedAt: new Date(l.publishedAt) });
    lessonsByCourse.set(key, arr);
  }
  const lessonIds = lessons.map((l) => l._id);

  // 3) Owners still active + not suspended.
  const ownerIds = [...ownerIdSet].map((id) => new Types.ObjectId(id));
  const users = await User.find({
    _id: { $in: ownerIds },
    isActive: true,
    isSuspended: false,
  })
    .select("firstName secondName thirdName parentPhone")
    .lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  // 4) Progress for those owners on those lessons.
  const progressRows = await LessonProgress.find({
    userId: { $in: ownerIds },
    lessonId: { $in: lessonIds },
  })
    .select("userId lessonId watchedPercentage isCompleted")
    .lean();
  const progByUserLesson = new Map<
    string,
    { watchedPercentage: number; isCompleted: boolean }
  >();
  for (const pr of progressRows) {
    progByUserLesson.set(`${String(pr.userId)}|${String(pr.lessonId)}`, {
      watchedPercentage: pr.watchedPercentage,
      isCompleted: pr.isCompleted,
    });
  }

  const students: StudentReport[] = [];
  for (const [uid, courseSet] of coursesByUser) {
    const u = userById.get(uid);
    if (!u) continue; // inactive / suspended / filtered out

    const watched: ReportLesson[] = [];
    const missed: ReportLesson[] = [];
    for (const cid of courseSet) {
      const en = enrolledAt.get(`${uid}|${cid}`);
      if (!en) continue;
      for (const l of lessonsByCourse.get(cid) ?? []) {
        const pr = progByUserLesson.get(`${uid}|${l.id}`);
        const entry: ReportLesson = { lesson_id: l.id, lesson_title: l.title };
        if (isLessonFinished(pr?.watchedPercentage, pr?.isCompleted)) {
          watched.push(entry);
        } else if (en <= matureCutoff && l.publishedAt <= matureCutoff) {
          missed.push(entry);
        }
      }
    }
    if (watched.length === 0 && missed.length === 0) continue;

    students.push({
      student_id: uid,
      parent_id: `p_${uid}`,
      teacher_id: env.PLATFORM_TEACHER_ID,
      student_name: `${u.firstName} ${u.secondName} ${u.thirdName}`.trim(),
      watched_lessons: watched,
      missed_lessons: missed,
      parent_consent: !!u.parentPhone,
    });
  }

  return { ...empty, students };
}

// ── Arabic digit + message helpers ─────────────────────────

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

/**
 * Builds the single-line, comma-separated list of behind lessons that goes into
 * the WhatsApp template's {{3}} variable. Kept on ONE line on purpose: a
 * WhatsApp template variable may not contain newlines.
 *   "الجبر (٣٥٪)، الهندسة (لسه ماتفتحش)"
 */
export function buildLessonsSummaryLine(behind: BehindLesson[]): string {
  return behind
    .map((l) =>
      l.status === "not_opened"
        ? `${l.lesson_title} (لسه ماتفتحش)`
        : `${l.lesson_title} (${toArabicDigits(l.watched_percentage)}٪)`,
    )
    .join("، ");
}

// ── Parent notification (WF8) ─────────────────────────────────

export interface NotifyParentResult {
  ok: boolean;
  sent: boolean;
  consent_granted: boolean;
  message: string;
}

/**
 * Called by WF8. Looks up the student + parent phone, RE-COMPUTES the student's
 * weekly report from actively owned-course lessons (single source of truth — never
 * trusts a list passed from n8n), builds the FIXED Arabic message, and sends it.
 *
 * The wording is a fixed template (see whatsapp.client.ts), never AI-generated.
 * When WhatsApp is not configured yet the send helper logs the rendered message
 * and reports sent:false without throwing, so the whole pipeline is testable.
 *
 * Always resolves with a small result object so WF8 can log the outcome without
 * treating "nothing to send" or "not configured" as a bug.
 */
export async function notifyParent(input: {
  parent_id: string;
  student_id: string;
  teacher_id: string;
  notification_type: string;
  notification_id: string;
  message_context: Record<string, unknown>;
}): Promise<NotifyParentResult> {
  if (!isMatchingTeacher(input.teacher_id)) {
    return {
      ok: true,
      sent: false,
      consent_granted: false,
      message: "Unknown teacher, no action taken",
    };
  }
  if (!Types.ObjectId.isValid(input.student_id)) {
    return {
      ok: true,
      sent: false,
      consent_granted: false,
      message: "Invalid student id",
    };
  }

  const user = await User.findById(input.student_id)
    .select("firstName secondName thirdName parentPhone isActive isSuspended")
    .lean();
  if (!user || !user.isActive || user.isSuspended) {
    return {
      ok: true,
      sent: false,
      consent_granted: false,
      message: "Student not found or inactive",
    };
  }

  // No parent phone => nothing to send. (parentPhone is required at
  // registration, so this is a defensive check, not an expected path.)
  if (!user.parentPhone) {
    return {
      ok: true,
      sent: false,
      consent_granted: false,
      message: "No parent phone on file",
    };
  }

  const courses = await computeStudentReport(
    new Types.ObjectId(input.student_id),
  );

  // Nothing in the student’s active-course report scope =>
  // there is nothing to report, so don't send.
  if (courses.length === 0) {
    return {
      ok: true,
      sent: false,
      consent_granted: true,
      message: "No reportable lessons to report",
    };
  }

  const studentName =
    `${user.firstName} ${user.secondName} ${user.thirdName}`.trim();

  const result = await sendParentDigestTemplate({
    toPhone: user.parentPhone,
    studentName,
    courses: courses.map((course) => ({
      courseTitle: course.course_title,
      completedTitles: course.completed_lessons.map(
        (lesson) => lesson.lesson_title,
      ),
      inProgressTitles: course.in_progress_lessons.map(
        (lesson) => lesson.lesson_title,
      ),
      notStartedTitles: course.not_started_lessons.map(
        (lesson) => lesson.lesson_title,
      ),
    })),
  });

  logger.info("[internal.notify-parent] processed", {
    notificationId: input.notification_id,
    studentId: input.student_id,
    courseCount: courses.length,
    completedCount: courses.reduce(
      (count, course) => count + course.completed_lessons.length,
      0,
    ),
    inProgressCount: courses.reduce(
      (count, course) => count + course.in_progress_lessons.length,
      0,
    ),
    notStartedCount: courses.reduce(
      (count, course) => count + course.not_started_lessons.length,
      0,
    ),
    sent: result.sent,
    configured: result.configured,
    reason: result.reason,
  });

  return {
    ok: true,
    sent: result.sent,
    consent_granted: true,
    message: result.configured
      ? result.sent
        ? "WhatsApp digest sent"
        : `WhatsApp send failed (${result.reason})`
      : "WhatsApp not configured on this instance (message logged, not sent)",
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function normalizePositiveInt(
  raw: unknown,
  defaultVal: number,
  min: number,
  max: number,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return defaultVal;
  return Math.min(Math.max(n, min), max);
}

// ── Student self-stats (WF10) ─────────────────────────────────────────────────

export interface StudentSelfStatsResult {
  ok: boolean;
  student_name: string;
  stage: string | null;
  total_lessons_available: number;
  completed_lessons: number;
  completion_percentage: number;
  total_watch_minutes: number;
  last_active_at: string | null;
  active_days_last_30: number;
  owned_courses_count: number;
  recent_lessons: Array<{
    lesson_title: string;
    watched_percentage: number;
    is_completed: boolean;
    last_watched_at: string;
  }>;
}

/**
 * Returns the CALLING student's own learning stats. Called by WF10 which is
 * itself invoked as a tool from WF6 (student chatbot) — the student_id in
 * WF6 is locked from the Normalize Payload (server-side value), so a student
 * asking "how am I doing?" can only ever see their own numbers.
 */
export async function getStudentSelfStats(input: {
  student_id: string;
  teacher_id: string;
}): Promise<StudentSelfStatsResult> {
  const empty: StudentSelfStatsResult = {
    ok: true,
    student_name: "",
    stage: null,
    total_lessons_available: 0,
    completed_lessons: 0,
    completion_percentage: 0,
    total_watch_minutes: 0,
    last_active_at: null,
    active_days_last_30: 0,
    owned_courses_count: 0,
    recent_lessons: [],
  };

  // Wrong teacher — refuse to return anything. Single-tenant means only one
  // teacher_id is valid; a mismatched value is either a bug or an attack.
  if (input.teacher_id !== env.PLATFORM_TEACHER_ID) return empty;
  if (!Types.ObjectId.isValid(input.student_id)) return empty;

  const user = await User.findById(input.student_id)
    .select("firstName secondName thirdName stage isActive isSuspended")
    .lean();
  if (!user || !user.isActive || user.isSuspended) return empty;

  const now = new Date();
  const ownedCoursesCount = await Enrollment.countDocuments({
    userId: input.student_id,
    status: ENROLLMENT_STATUS.ACTIVE,
  });

  const totalLessons = await Lesson.countDocuments({
    stage: user.stage,
    isPublished: true,
  });

  const [progressAgg] = await LessonProgress.aggregate<{
    _id: null;
    completed: number;
    total_seconds: number;
    last_active: Date | null;
  }>([
    { $match: { userId: new Types.ObjectId(input.student_id) } },
    {
      $group: {
        _id: null,
        completed: { $sum: { $cond: ["$isCompleted", 1, 0] } },
        total_seconds: { $sum: "$lastWatchedSecond" },
        last_active: { $max: "$lastWatchedAt" },
      },
    },
  ]);

  // Distinct calendar days with activity in the last 30 days — a rough
  // engagement signal the AI can turn into an encouraging response.
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const activeDaysAgg = await LessonProgress.aggregate<{ _id: string }>([
    {
      $match: {
        userId: new Types.ObjectId(input.student_id),
        lastWatchedAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$lastWatchedAt" },
        },
      },
    },
  ]);

  const recent = await LessonProgress.find({
    userId: new Types.ObjectId(input.student_id),
  })
    .sort({ lastWatchedAt: -1 })
    .limit(5)
    .populate<{ lessonId: { title: string } | null }>("lessonId", "title")
    .lean();

  const completed = progressAgg?.completed ?? 0;
  const totalSeconds = progressAgg?.total_seconds ?? 0;
  const lastActive = progressAgg?.last_active ?? null;

  return {
    ok: true,
    student_name:
      `${user.firstName} ${user.secondName} ${user.thirdName}`.trim(),
    stage: user.stage,
    total_lessons_available: totalLessons,
    completed_lessons: completed,
    completion_percentage:
      totalLessons > 0 ? Math.round((completed / totalLessons) * 1000) / 10 : 0,
    total_watch_minutes: Math.round(totalSeconds / 60),
    last_active_at: lastActive ? lastActive.toISOString() : null,
    active_days_last_30: activeDaysAgg.length,
    owned_courses_count: ownedCoursesCount,
    recent_lessons: recent
      .filter((r) => r.lessonId && typeof r.lessonId === "object")
      .map((r) => ({
        lesson_title: (r.lessonId as { title?: string })?.title ?? "درس",
        watched_percentage: Math.round(r.watchedPercentage),
        is_completed: r.isCompleted,
        last_watched_at: r.lastWatchedAt.toISOString(),
      })),
  };
}
