import { env } from "../../config/env";
import { logger } from "../../shared/utils/logger";
import {
  sendWhatsappText,
  isWhatsappReady,
  toWhatsappNumber,
} from "../whatsapp-bridge/whatsapp-bridge.service";

/**
 * Notifications-facing WhatsApp helpers.
 *
 * ── How messages actually go out ──────────────────────────────────────────────
 * Every WhatsApp message leaves the platform through the in-process Baileys
 * bridge (see modules/whatsapp-bridge). This file is a thin, stable facade the
 * rest of the app already imports — `sendParentDigestTemplate` and
 * `sendTextMessage` keep their old signatures so nothing upstream had to change
 * when we moved off Meta's Cloud API onto the self-hosted bridge.
 *
 * Because Baileys sends free-form text (no Meta template, no 24-hour window, no
 * per-message approval), the FIXED parent-digest wording now lives HERE in code
 * — plain, non-AI text as required — instead of in a Meta-registered template.
 *
 * When the bridge is not linked yet, the send helpers are safe no-ops that only
 * LOG the fully-rendered message, so the whole notification pipeline stays
 * testable before the teacher scans the QR to link a number.
 */

/**
 * Kept for backward compatibility. Under the bridge model "configured" simply
 * means the WhatsApp socket is currently linked and ready to send.
 */
export function isWhatsappConfigured(): boolean {
  return isWhatsappReady();
}

/** Re-exported EG phone normalizer (single implementation lives in the bridge). */
export const toWhatsappAddress = toWhatsappNumber;

export interface SendTemplateResult {
  sent: boolean;
  /** true when the bridge was linked/ready at send time (old field name kept). */
  configured: boolean;
  messageId: string | null;
  reason: string;
}

/**
 * Builds the FIXED Arabic parent digest message. Non-AI, deterministic wording;
 * it groups every lesson by course and makes completion state explicit.
 */
function buildParentDigestMessage(input: {
  studentName: string;
  courses: Array<{
    courseTitle: string;
    completedTitles: string[];
    inProgressTitles: string[];
    notStartedTitles: string[];
  }>;
}): string {
  const lines = [
    "السلام عليكم ورحمة الله وبركاته 🌸",
    "",
    `متابعة الطالب: ${input.studentName}`,
  ];

  for (const course of input.courses) {
    const total =
      course.completedTitles.length +
      course.inProgressTitles.length +
      course.notStartedTitles.length;
    lines.push(
      "",
      `📚 ${course.courseTitle} — أتمّ ${course.completedTitles.length} من أصل ${total} دروس.`,
    );

    if (total > 0 && course.completedTitles.length === total) {
      lines.push("🎉 تم إكمال الكورس بالكامل.");
      continue;
    }
    if (course.completedTitles.length > 0) {
      lines.push(`✅ الدروس المكتملة: ${course.completedTitles.join("، ")}.`);
    }
    if (course.inProgressTitles.length > 0) {
      lines.push(
        `▶️ دروس بدأها ولم يُكمل مشاهدتها: ${course.inProgressTitles.join("، ")}.`,
      );
    }
    if (course.notStartedTitles.length > 0) {
      lines.push(
        `⏳ دروس لم يشاهدها بعد: ${course.notStartedTitles.join("، ")}.`,
      );
    }
  }

  lines.push("", "شكرًا لمتابعتكم 🌱");
  return lines.join("\n");
}

/**
 * Sends the weekly parent behind-lesson digest.
 *
 * The message is a weekly progress report grouped by the student's actively
 * owned courses, including completed, in-progress, and untouched lessons.
 *
 * Never throws — a messaging failure must not break the caller's request/loop.
 */
export async function sendParentDigestTemplate(input: {
  toPhone: string;
  studentName: string;
  courses: Array<{
    courseTitle: string;
    completedTitles: string[];
    inProgressTitles: string[];
    notStartedTitles: string[];
  }>;
}): Promise<SendTemplateResult> {
  const text = buildParentDigestMessage(input);
  const res = await sendWhatsappText(input.toPhone, text);

  if (!res.ready) {
    logger.info("[whatsapp] (bridge not linked) parent digest not sent", {
      to: env.NODE_ENV !== "production" ? input.toPhone : "***",
      studentName: input.studentName,
      reason: res.reason,
    });
  }

  return {
    sent: res.sent,
    configured: res.ready,
    messageId: res.messageId,
    reason: res.reason,
  };
}

/**
 * Sends a plain-text WhatsApp message. Used for the support agent's replies and
 * teacher escalation pings. Never throws.
 */
export async function sendTextMessage(input: {
  toPhone: string;
  text: string;
}): Promise<SendTemplateResult> {
  const res = await sendWhatsappText(input.toPhone, input.text);
  return {
    sent: res.sent,
    configured: res.ready,
    messageId: res.messageId,
    reason: res.reason,
  };
}

/**
 * Builds the FIXED, friendly Arabic welcome messages sent right after a student
 * registers. Non-AI, deterministic wording — only the platform name and the
 * student's name are filled in. Two tailored variants: one addressed to the
 * student, one to the parent. No consent/opt-out wording by design.
 */
function buildStudentWelcomeMessage(
  platform: string,
  studentName: string,
): string {
  const firstName = studentName.trim().split(/\s+/)[0] || "الطالب";
  return [
    `أهلاً بيك يا ${firstName}🌟.`,
    `نوّرت منصة ${platform}! تم إنشاء حسابك بنجاح 🤍`,
    "ده الرقم اللي المنصة هتتواصل معاك منه، وهتتابعك عليه أول بأول لو نزلت دروس جديدة في الكورسات المشترك فيها.",
    "مستنيينك تبدأ رحلتك معانا، وأي حاجة تحتاجها احنا موجودين. بالتوفيق 💪",
  ].join("\n");
}

function buildParentWelcomeMessage(
  platform: string,
  studentName: string,
): string {
  return [
    "السلام عليكم ورحمة الله 🌸",
    `مع حضراتكم منصة ${platform} 🤍.`,
    `حابين نطمّنكم إن الطالب ${studentName} سجّل معانا في المنصة.`,
    "إحنا هنكون معاه خطوة بخطوة، وهنوافيكم بمتابعة لمستواه أول بأول. شكراً لثقتكم فينا 🌱🙏🤍",
  ].join("\n");
}

/**
 * Sends the registration welcome to BOTH the student and the parent, each with
 * its own tailored wording. Fire-and-forget friendly: never throws, and a
 * failure on one number never blocks the other or the caller. Safe no-op (logs
 * only) when the bridge is not linked.
 */
export async function sendRegistrationWelcome(input: {
  studentPhone: string;
  parentPhone: string;
  studentName: string;
}): Promise<void> {
  const platform = env.PLATFORM_NAME?.trim() || "منصتنا";
  const name = input.studentName?.trim() || "الطالب";

  const results = await Promise.allSettled([
    sendWhatsappText(
      input.studentPhone,
      buildStudentWelcomeMessage(platform, name),
    ),
    sendWhatsappText(
      input.parentPhone,
      buildParentWelcomeMessage(platform, name),
    ),
  ]);

  const [student, parent] = results;
  logger.info("[whatsapp] registration welcome processed", {
    studentName: name,
    studentSent: student.status === "fulfilled" ? student.value.sent : false,
    parentSent: parent.status === "fulfilled" ? parent.value.sent : false,
  });
}
