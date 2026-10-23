import { env } from "../../config/env";
import { ENROLLMENT_STATUS } from "../../config/constants";
import { Enrollment } from "../enrollments/enrollment.model";
import { User } from "../users/user.model";
import { logger } from "../../shared/utils/logger";
import { sendWhatsappText } from "../whatsapp-bridge/whatsapp-bridge.service";

interface LessonPublishedNotificationInput {
  courseId: string;
  courseTitle: string;
  lessonTitle: string;
  lessonSlug: string;
}

function buildLessonLink(lessonSlug: string): string {
  return new URL(
    `/player/${encodeURIComponent(lessonSlug)}`,
    env.CLIENT_URL,
  ).toString();
}

function buildLessonPublishedMessage(input: {
  studentFirstName: string;
  courseTitle: string;
  lessonTitle: string;
  lessonLink: string;
}): string {
  const platformName = env.PLATFORM_NAME?.trim() || "منصتنا";
  return [
    `أهلاً يا ${input.studentFirstName} 🌟`,
    `نزل درس جديد في كورس ${input.courseTitle} على منصة ${platformName}.`,
    `📚 الدرس: ${input.lessonTitle}`,
    "تقدر تبدأ المشاهدة من هنا:",
    input.lessonLink,
  ].join("\n");
}

/**
 * Sends the new-lesson announcement only to active, non-suspended students
 * who currently own the lesson's course. This is intentionally a best-effort
 * side effect: a disconnected WhatsApp bridge or one bad phone number must
 * never roll back a successfully published lesson.
 */
export async function notifyCourseOwnersAboutPublishedLesson(
  input: LessonPublishedNotificationInput,
): Promise<void> {
  try {
    const ownerIds = await Enrollment.distinct("userId", {
      courseId: input.courseId,
      status: ENROLLMENT_STATUS.ACTIVE,
    });

    if (ownerIds.length === 0) {
      logger.info("[lesson-notification] no active course owners to notify", {
        courseId: input.courseId,
        lessonSlug: input.lessonSlug,
      });
      return;
    }

    const students = await User.find({
      _id: { $in: ownerIds },
      isActive: true,
      isSuspended: false,
    })
      .select("firstName studentPhone")
      .lean();

    const lessonLink = buildLessonLink(input.lessonSlug);
    let sent = 0;
    let skippedOrFailed = 0;

    // Keep concurrency deliberately small. A large course should not create a
    // burst of simultaneous requests to the linked WhatsApp session.
    const batchSize = 5;
    for (let start = 0; start < students.length; start += batchSize) {
      const batch = students.slice(start, start + batchSize);
      const results = await Promise.all(
        batch.map(async (student) =>
          sendWhatsappText(
            student.studentPhone,
            buildLessonPublishedMessage({
              studentFirstName: student.firstName,
              courseTitle: input.courseTitle,
              lessonTitle: input.lessonTitle,
              lessonLink,
            }),
          ),
        ),
      );

      for (const result of results) {
        if (result.sent) sent += 1;
        else skippedOrFailed += 1;
      }
    }

    logger.info("[lesson-notification] publish announcement processed", {
      courseId: input.courseId,
      lessonSlug: input.lessonSlug,
      eligibleStudents: students.length,
      sent,
      skippedOrFailed,
    });
  } catch (error) {
    logger.error("[lesson-notification] publish announcement failed", {
      courseId: input.courseId,
      lessonSlug: input.lessonSlug,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
