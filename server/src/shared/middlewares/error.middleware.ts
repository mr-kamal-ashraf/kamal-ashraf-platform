import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodIssue } from "zod";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import multer from "multer";
import { ApiError } from "../utils/ApiError";
import { sendError } from "../utils/ApiResponse";
import { logger } from "../utils/logger";
import { env } from "../../config/env";

/**
 * Arabic labels for every field name the frontend can send.
 *
 * The Zod formatter below prefers the label over the raw field name so users
 * never see identifiers like "book_id" or "durationMinutes" in a toast. Add
 * an entry here whenever a new schema field appears — leaving it out doesn't
 * break anything, it just falls back to the raw name.
 */
const FIELD_LABELS_AR: Record<string, string> = {
  // Lessons
  title: "العنوان",
  slug: "المسار (slug)",
  description: "الوصف المختصر",
  longDescription: "الوصف التفصيلي",
  stage: "المرحلة",
  durationMinutes: "مدة الدرس بالدقيقة",
  chapters: "عدد الفصول",
  topics: "محاور الدرس",
  thumbnail: "الصورة المصغّرة",
  thumbnailGradient: "تدرّج الصورة",
  order: "الترتيب",
  isPublished: "حالة النشر",
  // Pagination
  page: "رقم الصفحة",
  limit: "عدد النتائج",
  search: "البحث",
  // Auth / users
  name: "الاسم",
  firstName: "الاسم الأول",
  secondName: "الاسم الثاني",
  thirdName: "الاسم الثالث",
  fullName: "الاسم بالكامل",
  email: "البريد الإلكتروني",
  phone: "رقم الهاتف",
  parentPhone: "رقم هاتف ولي الأمر",
  password: "كلمة المرور",
  currentPassword: "كلمة المرور الحالية",
  newPassword: "كلمة المرور الجديدة",
  confirmPassword: "تأكيد كلمة المرور",
  code: "الكود",
  codeIds: "الأكواد",
  // Payments / course codes
  method: "طريقة الدفع",
  walletPhone: "رقم المحفظة",
  courseId: "الكورس",
  count: "عدد الأكواد",
  price: "السعر",
  disabled: "حالة الكود",
  // AI curriculum
  book_id: "رقم الكتاب",
  book_version: "إصدار الكتاب",
  subject: "المادة",
  grade: "الصف الدراسي",
  file: "الملف",
  file_url: "رابط الملف",
  // AI chat
  message: "الرسالة",
  conversation_id: "معرّف المحادثة",
  // Site settings (admin → المظهر والمحتوى)
  palette: "الباليت",
  font: "الخط",
  defaultMode: "الوضع الافتراضي",
  badge: "نص البادج",
  line1: "السطر الأول",
  highlight: "الكلمة الملونة",
  highlights: "الكلمات الملونة",
  line2: "السطر الثاني",
  primaryCta: "نص الزرار الأساسي",
  secondaryCta: "نص الزرار الثانوي",
  label: "الوصف",
  value: "الرقم",
  goal: "جملة الهدف",
  q: "السؤال",
  a: "الإجابة",
  whatsapp: "رقم الواتساب",
  facebook: "لينك فيسبوك",
  instagram: "لينك إنستجرام",
  youtube: "لينك يوتيوب",
  tiktok: "لينك تيك توك",
  telegram: "لينك تليجرام",
  text: "النص",
  linkUrl: "اللينك",
  endsAt: "تاريخ النهاية",
};

/**
 * Translate a single Zod issue into one friendly Arabic sentence.
 * The Zod raw messages ("Required", "String must contain at least 1 character(s)")
 * are English + technical; users see the friendly version instead.
 */
function friendlyIssue(issue: ZodIssue): string {
  // The field is the deepest named segment, so nested paths such as
  // ["items", 2, "q"] still resolve to a label ("السؤال").
  const rawKey = [...issue.path].reverse().find((p) => typeof p === "string");
  const label =
    typeof rawKey === "string"
      ? (FIELD_LABELS_AR[rawKey] ?? rawKey)
      : "الحقل";
  // Which list item the issue is in (1-based), e.g. the 3rd FAQ question.
  const index = issue.path.find((p) => typeof p === "number");
  const where = typeof index === "number" ? ` (رقم ${index + 1})` : "";
  return friendlyIssueText(issue, label) + where;
}

function friendlyIssueText(issue: ZodIssue, label: string): string {
  // Messages written in Arabic inside a schema (refinements like "اللينك لازم
  // يبدأ بـ https://") are already user-facing — show them as they are.
  if (issue.code === "custom" && /[\u0600-\u06FF]/.test(issue.message)) {
    return issue.message;
  }

  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined" || issue.received === "null") {
        return `من فضلك املأ خانة "${label}"`;
      }
      return `خانة "${label}" مش بالشكل المطلوب`;

    case "too_small": {
      const min = issue.minimum as number;
      if (issue.type === "string") {
        if (min <= 1) return `من فضلك املأ خانة "${label}"`;
        return `"${label}" لازم يكون على الأقل ${min} حرف`;
      }
      if (issue.type === "number") {
        return `"${label}" لازم يكون على الأقل ${min}`;
      }
      if (issue.type === "array") {
        return `"${label}" لازم تحتوي على الأقل ${min} عنصر`;
      }
      return `"${label}" صغير جداً`;
    }

    case "too_big": {
      const max = issue.maximum as number;
      if (issue.type === "string") {
        return `"${label}" طويل جداً (الحد الأقصى ${max} حرف)`;
      }
      if (issue.type === "number") {
        return `"${label}" أكبر من المسموح (الحد الأقصى ${max})`;
      }
      if (issue.type === "array") {
        return `"${label}" فيه عناصر أكتر من المسموح (${max} عنصر)`;
      }
      return `"${label}" أكبر من المسموح`;
    }

    case "invalid_string": {
      const kind = (issue as { validation?: string }).validation;
      if (kind === "email") return `"${label}" لازم يكون بريد إلكتروني صحيح`;
      if (kind === "url") return `"${label}" لازم يكون رابط صحيح`;
      if (kind === "uuid") return `"${label}" مش بالصيغة المطلوبة`;
      if (kind === "regex") return `"${label}" فيه حروف غير مسموح بها`;
      return `"${label}" مش بالصيغة المطلوبة`;
    }

    case "invalid_enum_value":
      return `اختار قيمة صحيحة لـ "${label}"`;

    case "unrecognized_keys":
      return "في بيانات مش متعرف عليها في الطلب";

    default:
      return `راجع خانة "${label}"`;
  }
}

/**
 * Convert a full ZodError into ONE friendly Arabic message for the user toast.
 *
 * Deliberately does NOT dump every field's raw error joined with dashes — that
 * produces the "book_id: Required — file_url: Required — subject: String must
 * contain at least 1 character(s)" wall of English/mixed text that leaks
 * implementation details and isn't readable. One clean sentence per response.
 * Field-level detail is still available in the response's `details`.
 */
function formatZodErrorUserMessage(err: ZodError): string {
  const issues = err.issues ?? [];
  if (issues.length === 0) {
    return "البيانات المُرسلة غير صالحة، راجع الحقول وحاول مرة أخرى.";
  }

  // One issue per unique path (Zod can emit multiple issues on the same field).
  const perField: string[] = [];
  const seenPath = new Set<string>();
  for (const issue of issues) {
    const key = issue.path.join(".") || "__form__";
    if (seenPath.has(key)) continue;
    seenPath.add(key);
    perField.push(friendlyIssue(issue));
  }

  if (perField.length === 1) return perField[0];
  if (perField.length === 2) return `${perField[0]}، و${perField[1]}.`;
  // 3+ fields: keep the top-line short so it renders cleanly in a toast.
  return `فيه أكتر من حقل محتاج مراجعة: ${perField.slice(0, 3).join("، ")}${
    perField.length > 3 ? "، وغيرها" : ""
  }.`;
}

/**
 * Multer errors have a machine-readable `.code` — translate them to Arabic
 * instead of the default English "File too large" the library emits.
 */
function formatMulterError(err: multer.MulterError): {
  message: string;
  code: string;
  statusCode: number;
} {
  switch (err.code) {
    case "LIMIT_FILE_SIZE":
      return {
        message: "الملف كبير جداً، من فضلك ارفع ملف أصغر.",
        code: "FILE_TOO_LARGE",
        statusCode: 413,
      };
    case "LIMIT_UNEXPECTED_FILE":
      return {
        message: "الملف اتبعت في خانة غير متوقعة، جرّب تاني.",
        code: "UNEXPECTED_FILE_FIELD",
        statusCode: 400,
      };
    case "LIMIT_FILE_COUNT":
      return {
        message: "عدد الملفات المرفوعة أكتر من المسموح.",
        code: "TOO_MANY_FILES",
        statusCode: 400,
      };
    case "LIMIT_FIELD_COUNT":
    case "LIMIT_FIELD_KEY":
    case "LIMIT_FIELD_VALUE":
    case "LIMIT_PART_COUNT":
      return {
        message: "البيانات المرفقة مع الملف مش بالشكل المطلوب.",
        code: "INVALID_UPLOAD_FIELDS",
        statusCode: 400,
      };
    default:
      return {
        message: "حصل خطأ أثناء رفع الملف، جرّب تاني.",
        code: "UPLOAD_ERROR",
        statusCode: 400,
      };
  }
}

/**
 * Global error-handling middleware — must be registered LAST in Express.
 *
 * ONE overriding rule: every `message` field returned to the client is a
 * short, friendly Arabic sentence a teacher/student can read and act on —
 * NEVER a raw library error, stack fragment, or field-by-field Zod dump.
 * Field-level detail (when needed for debugging) goes in `details`.
 *
 * Error priority order:
 *   1. ApiError            — our own operational errors (already user-friendly)
 *   2. ZodError            — request validation failures → friendly summary
 *   3. multer.MulterError  — file upload issues (size, unexpected field, …)
 *   4. Mongoose ValidationError / CastError
 *   5. MongoDB duplicate-key (unique index violation)
 *   6. JWT errors (expired or tampered tokens)
 *   7. Everything else → generic 500 with the internal detail logged
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Our own typed errors — status code and message are already set (and are
  // authored to be user-facing at the throw site, so no translation here).
  if (err instanceof ApiError) {
    if (!err.isOperational) {
      logger.error("Non-operational ApiError", {
        message: err.message,
        path: req.path,
      });
    }
    return sendError(res, {
      statusCode: err.statusCode,
      message: err.message,
      code: err.code,
      details: err.details,
    });
  }

  // Request body / query / params failed Zod schema validation.
  if (err instanceof ZodError) {
    return sendError(res, {
      statusCode: 422,
      message: formatZodErrorUserMessage(err),
      code: "VALIDATION_ERROR",
      details: err.flatten(),
    });
  }

  // Multer (multipart/form-data) errors — file too large, wrong field, etc.
  if (err instanceof multer.MulterError) {
    const { message, code, statusCode } = formatMulterError(err);
    return sendError(res, {
      statusCode,
      message,
      code,
    });
  }

  // Mongoose document failed its schema validators.
  if (err instanceof mongoose.Error.ValidationError) {
    return sendError(res, {
      statusCode: 422,
      message: "البيانات المُرسلة غير مكتملة، راجع الحقول وحاول مرة أخرى.",
      code: "DB_VALIDATION_ERROR",
      details: Object.fromEntries(
        Object.entries(err.errors).map(([k, v]) => [k, v.message]),
      ),
    });
  }

  // A route param like :id could not be cast to ObjectId.
  if (err instanceof mongoose.Error.CastError) {
    return sendError(res, {
      statusCode: 400,
      message: "الرابط اللي فتحته مش صحيح.",
      code: "INVALID_ID",
    });
  }

  // MongoDB error code 11000 = unique index violation (e.g. duplicate email).
  if (
    err instanceof Error &&
    err.name === "MongoServerError" &&
    "code" in err &&
    (err as unknown as { code: number }).code === 11000
  ) {
    return sendError(res, {
      statusCode: 409,
      message: "في بيانات مكرّرة — راجع الحقول اللي بتحاول تسجّلها.",
      code: "DUPLICATE_KEY",
    });
  }

  if (err instanceof jwt.TokenExpiredError) {
    return sendError(res, {
      statusCode: 401,
      message: "الجلسة انتهت، من فضلك سجّل الدخول تاني.",
      code: "TOKEN_EXPIRED",
    });
  }

  if (err instanceof jwt.JsonWebTokenError) {
    return sendError(res, {
      statusCode: 401,
      message: "جلستك غير صالحة، من فضلك سجّل الدخول تاني.",
      code: "INVALID_TOKEN",
    });
  }

  // express.json() / urlencoded() body errors carry a `type` and a status.
  // Without this they fall through to a misleading 500.
  const bodyErrorType =
    err instanceof Error ? (err as Error & { type?: unknown }).type : undefined;
  if (bodyErrorType === "entity.too.large") {
    return sendError(res, {
      statusCode: 413,
      message: "البيانات المبعوتة كبيرة جداً، قلّل المحتوى وحاول تاني.",
      code: "PAYLOAD_TOO_LARGE",
    });
  }
  if (bodyErrorType === "entity.parse.failed") {
    return sendError(res, {
      statusCode: 400,
      message: "البيانات المبعوتة مش مفهومة، حدّث الصفحة وحاول تاني.",
      code: "INVALID_JSON",
    });
  }

  logger.error("Unhandled error", {
    error:
      err instanceof Error ? { message: err.message, stack: err.stack } : err,
    path: req.path,
    method: req.method,
  });

  // Never leak internal error messages to clients — the friendly Arabic line
  // goes to the user, and the details above go to the server log.
  return sendError(res, {
    statusCode: 500,
    message: "حصل خطأ غير متوقع في السيرفر، جرّب تاني بعد شوية.",
    code: "INTERNAL_ERROR",
    ...(env.NODE_ENV !== "production" && err instanceof Error
      ? { details: { devMessage: err.message } }
      : {}),
  });
}
