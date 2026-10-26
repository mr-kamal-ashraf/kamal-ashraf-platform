import { Types } from "mongoose";
import { User } from "../users/user.model";
import { Course } from "../courses/course.model";
import { Enrollment } from "../enrollments/enrollment.model";
import { Payment } from "../payments/payment.model";
import { Lesson } from "../lessons/lesson.model";
import { LessonProgress } from "../progress/progress.model";
import {
  SupportEscalation,
  type EscalationCategory,
} from "../support/escalation.model";
import { env } from "../../config/env";
import { logger } from "../../shared/utils/logger";
import {
  ENROLLMENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  STAGE_LABELS,
  type Stage,
} from "../../config/constants";
import { sendTextMessage } from "../notifications/whatsapp.client";
import { isKioskOffered } from "../payments/kiosk";
import { isAiRepliesEnabled } from "../whatsapp-bridge/whatsapp-bridge.service";
import {
  BEHIND_LESSON_DAYS_DEFAULT,
  computeBehindLessonsForStudent,
} from "./internal.service";

/**
 * Backing logic for the WhatsApp SUPPORT AGENT (a shared n8n workflow). Every
 * function here is a "tool" the agent can call through /internal/support/*.
 *
 * Guiding rules:
 *  - Read-only by default. The only writing tool is createEscalation, and it
 *    only records a request + pings the teacher — it never grants access,
 *    refunds money, or changes a student's data.
 *  - A student's private data (progress, payments) is only ever returned for a
 *    student_id the agent obtained from identifyContact on the SENDER's own
 *    phone number, so one person can never read another's data.
 */

function isMatchingTeacher(teacherId: string): boolean {
  return teacherId === env.PLATFORM_TEACHER_ID;
}

function fullName(u: {
  firstName: string;
  secondName: string;
  thirdName: string;
}): string {
  return `${u.firstName} ${u.secondName} ${u.thirdName}`.trim();
}

/**
 * Normalizes any phone spelling WhatsApp might send to the exact 11-digit
 * Egyptian form the User model stores ("01XXXXXXXXX"):
 *   201001234567 -> 01001234567
 *   +201001234567 -> 01001234567
 *   1001234567   -> 01001234567
 * Returns null when it cannot be coerced to that shape.
 */
export function normalizeEgPhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;
  let local = digits;
  if (local.startsWith("20")) local = local.slice(2); // drop country code
  if (local.length === 10 && local.startsWith("1")) local = `0${local}`; // 10.. -> 010..
  if (!local.startsWith("0")) local = `0${local}`;
  return /^01\d{9}$/.test(local) ? local : null;
}

// ── Tool 1: identify who is messaging ─────────────────────────────────────────

export interface IdentifiedContact {
  role: "student" | "parent";
  student_id: string;
  student_name: string;
  stage: Stage;
  stage_label: string;
  account_status: "active" | "not_activated";
}

/**
 * Resolves a WhatsApp phone number to the people it belongs to on this
 * platform. A student phone identifies that student; a parent phone can match
 * several children (siblings), so an array is returned. Empty array => unknown
 * sender (the agent treats them as a prospect / sales lead).
 */
export async function identifyContact(
  phone: string,
): Promise<{ found: boolean; contacts: IdentifiedContact[] }> {
  const norm = normalizeEgPhone(phone);
  if (!norm) return { found: false, contacts: [] };

  const users = await User.find({
    $or: [{ studentPhone: norm }, { parentPhone: norm }],
    isSuspended: false,
  })
    .select("firstName secondName thirdName stage studentPhone parentPhone isActive")
    .lean();

  const contacts: IdentifiedContact[] = [];
  for (const u of users) {
    const base = {
      student_id: String(u._id),
      student_name: fullName(u),
      stage: u.stage,
      stage_label: STAGE_LABELS[u.stage],
      account_status: (u.isActive ? "active" : "not_activated") as
        | "active"
        | "not_activated",
    };
    if (u.studentPhone === norm) contacts.push({ role: "student", ...base });
    if (u.parentPhone === norm) contacts.push({ role: "parent", ...base });
  }

  return { found: contacts.length > 0, contacts };
}

// ── Tool 2: public course catalog (for prospects & general questions) ─────────

export async function getSupportCatalog(): Promise<{
  platform_name: string;
  total: number;
  courses: Array<{
    course_id: string;
    title: string;
    slug: string;
    stage: Stage;
    stage_label: string;
    price: number;
    is_free: boolean;
  }>;
}> {
  const courses = await Course.find({ isPublished: true })
    .select("title slug stage price order")
    .sort({ stage: 1, order: 1 })
    .lean();

  return {
    platform_name: env.PLATFORM_NAME ?? "",
    total: courses.length,
    courses: courses.map((c) => ({
      course_id: String(c._id),
      title: c.title,
      slug: c.slug,
      stage: c.stage,
      stage_label: STAGE_LABELS[c.stage],
      price: c.price,
      is_free: c.price <= 0,
    })),
  };
}

// ── Tool 3: a known student's own context (owned courses, progress, payments) ─

export interface StudentSupportContext {
  found: boolean;
  student_name?: string;
  stage?: Stage;
  stage_label?: string;
  account_status?: "active" | "suspended" | "not_activated";
  owned_courses?: Array<{
    course_id: string;
    title: string;
    stage: Stage;
    price: number;
    lessons_total: number;
    lessons_completed: number;
    progress_percent: number;
  }>;
  recent_payments?: Array<{
    course_title: string;
    amount: number;
    currency: string;
    status: string;
    source: string | null;
    date: string;
  }>;
  behind_lessons_count?: number;
}

export async function getStudentSupportContext(
  studentId: string,
): Promise<StudentSupportContext> {
  if (!Types.ObjectId.isValid(studentId)) return { found: false };

  const user = await User.findById(studentId)
    .select("firstName secondName thirdName stage isActive isSuspended")
    .lean();
  if (!user) return { found: false };

  // Owned (active) courses.
  const enrollments = await Enrollment.find({
    userId: studentId,
    status: ENROLLMENT_STATUS.ACTIVE,
  })
    .populate<{ courseId: { _id: Types.ObjectId; title: string; stage: Stage; price: number } | null }>(
      "courseId",
      "title stage price",
    )
    .lean();

  const ownedCourseIds = enrollments
    .map((e) => (e.courseId ? e.courseId._id : null))
    .filter((id): id is Types.ObjectId => !!id);

  // Bulk: published lessons across all owned courses.
  const lessons = ownedCourseIds.length
    ? await Lesson.find({ courseId: { $in: ownedCourseIds }, isPublished: true })
        .select("_id courseId")
        .lean()
    : [];
  const lessonsByCourse = new Map<string, string[]>();
  for (const l of lessons) {
    const key = String(l.courseId);
    const arr = lessonsByCourse.get(key) ?? [];
    arr.push(String(l._id));
    lessonsByCourse.set(key, arr);
  }

  // Bulk: this student's completed lessons among those.
  const lessonIds = lessons.map((l) => l._id);
  const progress = lessonIds.length
    ? await LessonProgress.find({ userId: studentId, lessonId: { $in: lessonIds } })
        .select("lessonId isCompleted")
        .lean()
    : [];
  const completedLessonIds = new Set(
    progress.filter((p) => p.isCompleted).map((p) => String(p.lessonId)),
  );

  const owned_courses = enrollments
    .filter((e) => e.courseId)
    .map((e) => {
      const c = e.courseId!;
      const courseLessonIds = lessonsByCourse.get(String(c._id)) ?? [];
      const total = courseLessonIds.length;
      const completed = courseLessonIds.filter((id) => completedLessonIds.has(id)).length;
      return {
        course_id: String(c._id),
        title: c.title,
        stage: c.stage,
        price: c.price,
        lessons_total: total,
        lessons_completed: completed,
        progress_percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

  // Recent payments.
  const payments = await Payment.find({ userId: studentId })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate<{ courseId: { title: string } | null }>("courseId", "title")
    .lean();
  const now = Date.now();
  const kioskOn = isKioskOffered();
  const recent_payments = payments.map((p) => ({
    course_title: (p.courseId as { title?: string } | null)?.title ?? "كورس",
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    source: p.provider ?? null,
    method: p.method,
    // A cash reference still waiting at Aman / Masary: lets the agent give it
    // back to a student who lost it (this is their own number, checked by
    // phone) — while paying cash is switched on.
    ...(kioskOn &&
    p.method === PAYMENT_METHOD.KIOSK &&
    p.status === PAYMENT_STATUS.PENDING &&
    p.kioskReference &&
    p.expiresAt &&
    p.expiresAt.getTime() > now
      ? { kiosk_reference: p.kioskReference, kiosk_expires_at: p.expiresAt.toISOString() }
      : {}),
    date: p.createdAt.toISOString(),
  }));

  // How many matured lessons the student is behind on (reuses the digest logic).
  const behind = await computeBehindLessonsForStudent(
    new Types.ObjectId(studentId),
    BEHIND_LESSON_DAYS_DEFAULT,
  );

  return {
    found: true,
    student_name: fullName(user),
    stage: user.stage,
    stage_label: STAGE_LABELS[user.stage],
    account_status: user.isSuspended
      ? "suspended"
      : user.isActive
        ? "active"
        : "not_activated",
    owned_courses,
    recent_payments,
    behind_lessons_count: behind.length,
  };
}

// ── Tool 4: escalate a case to the teacher ────────────────────────────────────

export interface EscalationResult {
  ok: boolean;
  escalation_id: string | null;
  teacher_notified: boolean;
  message: string;
}

/**
 * Records an escalation (visible in the admin panel) AND pings the teacher on
 * WhatsApp. This is the ONLY writing tool the agent has, and it changes no
 * student data — it just hands the case to a human.
 */
export async function createEscalation(input: {
  teacher_id: string;
  from_phone: string;
  student_id?: string | null;
  category: EscalationCategory;
  summary: string;
}): Promise<EscalationResult> {
  if (!isMatchingTeacher(input.teacher_id)) {
    return { ok: true, escalation_id: null, teacher_notified: false, message: "Unknown teacher, no action taken" };
  }

  let studentId: Types.ObjectId | null = null;
  let studentName: string | null = null;
  if (input.student_id && Types.ObjectId.isValid(input.student_id)) {
    studentId = new Types.ObjectId(input.student_id);
    const u = await User.findById(studentId)
      .select("firstName secondName thirdName")
      .lean();
    if (u) studentName = fullName(u);
  }

  const doc = await SupportEscalation.create({
    fromPhone: normalizeEgPhone(input.from_phone) ?? input.from_phone,
    studentId,
    studentName,
    category: input.category,
    summary: input.summary,
  });

  // Ping the teacher (best-effort; never blocks the escalation record).
  let teacherNotified = false;
  if (env.TEACHER_SUPPORT_PHONE) {
    const who = studentName ? `الطالب: ${studentName}` : `رقم: ${doc.fromPhone}`;
    const text =
      `🔔 حالة محتاجة تدخّلك في منصة ${env.PLATFORM_NAME ?? ""}\n` +
      `النوع: ${input.category}\n` +
      `${who}\n` +
      `التفاصيل: ${input.summary}\n\n` +
      `تقدر تراجعها من لوحة التحكم.`;
    const ping = await sendTextMessage({ toPhone: env.TEACHER_SUPPORT_PHONE, text });
    teacherNotified = ping.sent;
  }

  if (teacherNotified && doc.teacherNotified !== true) {
    doc.teacherNotified = true;
    await doc.save().catch(() => undefined);
  }

  logger.info("[support.escalate] created", {
    escalationId: String(doc._id),
    category: input.category,
    teacherNotified,
  });

  return {
    ok: true,
    escalation_id: String(doc._id),
    teacher_notified: teacherNotified,
    message: "Escalation recorded",
  };
}


// ── Tool 5: send the agent's reply back to the sender ────────────────────────────

/**
 * Sends the support agent's reply to the sender over WhatsApp, from the
 * platform's own configured number. Keeping the send here (not in n8n) means
 * every WhatsApp credential lives in ONE place — this backend — exactly like
 * the parent-notification path. No-ops (logs only) when WhatsApp is not yet
 * configured.
 */
export async function sendSupportReply(input: {
  teacher_id: string;
  to_phone: string;
  text: string;
}): Promise<{ ok: boolean; sent: boolean; reason: string }> {
  if (!isMatchingTeacher(input.teacher_id)) {
    return { ok: true, sent: false, reason: "UNKNOWN_TEACHER" };
  }
  // The teacher switched the AI agent off in the admin panel. Covers a reply that
  // was already in flight in n8n when the switch was flipped.
  if (!isAiRepliesEnabled()) {
    return { ok: true, sent: false, reason: "AI_REPLIES_DISABLED" };
  }
  const res = await sendTextMessage({ toPhone: input.to_phone, text: input.text });
  return { ok: true, sent: res.sent, reason: res.reason };
}
