import { isApiError, type CurriculumBook } from "@/api";

/** What the admin sees in the red banner above the page when an upload fails. */
export interface UploadErrorInfo {
  /** Short headline: what kind of problem this is. */
  title: string;
  /** Full explanation: what happened and what to do about it. */
  message: string;
  /** Machine code, shown small so support can find the cause quickly. */
  code?: string;
  /** e.g. "HTTP 502 · ECONNRESET" — only when the server sent details. */
  technical?: string;
}

export const MAX_PDF_MB = 300;

/**
 * Headlines per server error code. The server's own `message` already says
 * what happened and what to do (see curriculum-upload-errors.ts on the
 * backend), so this map only adds a short title on top of it.
 */
const TITLES: Record<string, string> = {
  AI_SERVER_DOWN: "خدمة الذكاء الاصطناعي مش متاحة دلوقتي",
  AI_SERVER_ADDRESS_INVALID: "إعداد ناقص في المنصة",
  AI_TLS_ERROR: "إعداد ناقص في المنصة",
  INGEST_TIMEOUT: "الفهرسة أخدت وقت أطول من المسموح",
  AI_BACKEND_UNAUTHORIZED: "إعداد ناقص في المنصة",
  AI_OUT_OF_CREDIT: "رصيد الذكاء الاصطناعي خلص",
  AI_RATE_LIMIT: "ضغط مؤقت على خدمة الذكاء الاصطناعي",
  INGEST_WEBHOOK_NOT_FOUND: "خدمة الفهرسة مش شغالة",
  INGEST_PAYLOAD_TOO_LARGE: "الملف أكبر من المسموح",
  INGEST_INVALID_PAYLOAD: "بيانات الكتاب مرفوضة",
  INGEST_WORKFLOW_FAILED: "خطأ أثناء فهرسة الكتاب",
  INGEST_EMPTY_RESPONSE: "الفهرسة وقفت من غير نتيجة",
  INGEST_OCR_FAILED: "فشلت قراءة صفحات الكتاب المتصوّرة",
  INGEST_NO_TEXT_FOUND: "ما لقيناش نص مقروء في الكتاب",
  INGEST_STALLED: "الفهرسة وقفت من غير نتيجة",
  CURRICULUM_INDEXING: "الكتاب لسه بيتفهرس",
  BOOK_ID_EXISTS: "الرقم ده مستخدم بالفعل",
  CURRICULUM_NOT_FOUND: "الكتاب مش موجود",
  INGEST_REJECTED: "خدمة الفهرسة رفضت الكتاب",
  INGEST_UNEXPECTED_RESPONSE: "رد غير متوقع من خدمة الفهرسة",
  AI_UPSTREAM_ERROR: "خطأ من خدمة الذكاء الاصطناعي",
  INGEST_FILE_READ_FAILED: "المنصة مقدرتش تقرأ الملف",
  BUNNY_STORAGE_NOT_CONFIGURED: "إعداد ناقص في المنصة",
  BUNNY_AUTH_FAILED: "إعداد ناقص في المنصة",
  BUNNY_ZONE_NOT_FOUND: "إعداد ناقص في المنصة",
  BUNNY_TIMEOUT: "حفظ نسخة الكتاب أخد وقت طويل",
  BUNNY_UPLOAD_FAILED: "مشكلة في حفظ نسخة الكتاب",
  CURRICULUM_SAVE_FAILED: "الكتاب ما اتسجلش في القايمة",
  VALIDATION_ERROR: "بيانات ناقصة أو غلط",
  TOKEN_EXPIRED: "انتهت الجلسة",
  INVALID_TOKEN: "انتهت الجلسة",
};

/**
 * Codes the server only knows generically (multer/network layer): here we know
 * it is a curriculum PDF, so we can be specific. Same shape is reused for the
 * checks the form runs BEFORE sending anything.
 */
const SPECIFIC: Record<string, { title: string; message: string }> = {
  BAD_BOOK_ID: {
    title: "رقم الكتاب مش صحيح",
    message:
      "رقم الكتاب لازم يكون حروف إنجليزي أو أرقام أو شرطة (- أو _) فقط، من غير مسافات، وطوله من 1 لـ 64 حرف.",
  },
  BOOK_ID_EXISTS: {
    title: "الرقم ده مستخدم بالفعل",
    message:
      'فيه كتاب مرفوع بنفس الرقم ده بالفعل. لو عايز تحدّث الكتاب القديم دوس "استبدال" من كارته، ولو ده كتاب تاني اختار له رقم مختلف.',
  },
  NO_FILE: {
    title: "لسه ما اخترتش ملف",
    message: 'اختار ملف الكتاب (PDF) من جهازك الأول وبعدين دوس "رفع وفهرسة".',
  },
  NO_STAGE: {
    title: "لسه ما اخترتش الصف الدراسي",
    message:
      "اختار الصف الدراسي اللي الكتاب بيدرّسه عشان المساعد يعرف يربط الكتاب بالطلاب المناسبين.",
  },
  NOT_PDF: {
    title: "الملف مش PDF",
    message:
      "الملف اللي اخترته مش بصيغة PDF. حوّل الكتاب لـ PDF (مش صور أو Word) وارفعه تاني.",
  },
  FILE_TOO_LARGE: {
    title: "الملف أكبر من المسموح",
    message: `حجم الملف أكبر من ${MAX_PDF_MB} ميجا (الحد الأقصى لرفع المنهج). قسّم الكتاب على أكتر من ملف (مثلاً كل فصل لوحده) وارفع كل جزء برقم كتاب مختلف.`,
  },
  INVALID_PDF_FORMAT: {
    title: "الملف مش PDF",
    message:
      "الملف اللي اخترته مش بصيغة PDF. حوّل الكتاب لـ PDF (مش صور أو Word) وارفعه تاني.",
  },
  INVALID_PDF_CONTENT: {
    title: "الملف مش PDF صالح",
    message:
      "الملف امتداده PDF بس محتواه مش PDF حقيقي (ممكن يكون تالف أو اتغيّر امتداده). افتحه على جهازك للتأكد، أو صدّره PDF من جديد وارفعه تاني.",
  },
  UNEXPECTED_FILE_FIELD: {
    title: "حصل خطأ في إرسال الملف",
    message: "الملف اتبعت بشكل غلط. حدّث الصفحة (F5) وحاول تاني.",
  },
  NETWORK_ERROR: {
    title: "انقطع الاتصال بالمنصة",
    message:
      "الاتصال اتقطع قبل ما يوصلنا رد — ممكن الإنترنت ضعيف أو رفع الملف اتقطع (خصوصاً مع ملف كبير). راجع الإنترنت وحاول تاني.",
  },
  PROXY_GATEWAY_ERROR: {
    title: "الطلب اتقطع",
    message:
      "الطلب اتقطع قبل ما الفهرسة تخلص لأنه أخد وقت طويل. استنى دقيقتين وحاول تاني؛ ولو اتكرر جرّب ملف أصغر.",
  },
};

/** Banner content for the checks the form runs before sending anything. */
export function uploadErrorForCode(
  code: keyof typeof SPECIFIC,
): UploadErrorInfo {
  const { title, message } = SPECIFIC[code];
  return { title, message };
}

function technicalLine(details: unknown): string | undefined {
  if (!details || typeof details !== "object") return undefined;
  const d = details as {
    upstreamStatus?: unknown;
    networkCode?: unknown;
    upstreamErrorCode?: unknown;
  };
  const parts: string[] = [];
  if (typeof d.upstreamStatus === "number")
    parts.push(`HTTP ${d.upstreamStatus}`);
  if (typeof d.networkCode === "string") parts.push(d.networkCode);
  if (typeof d.upstreamErrorCode === "string") parts.push(d.upstreamErrorCode);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Banner content for a book whose background indexing failed. */
export function describeIndexingFailure(book: CurriculumBook): UploadErrorInfo {
  const code = book.error_code ?? undefined;
  return {
    title: `فشلت فهرسة "${book.book_id}"`,
    message:
      book.error_message ||
      "الفهرسة وقفت قبل ما تخلص. ارفع الكتاب تاني، ولو اتكرر كلّم المطوّر.",
    code,
  };
}

/** Turn whatever the upload call threw into the content of the error banner. */
export function describeUploadError(err: unknown): UploadErrorInfo {
  if (!isApiError(err)) {
    return {
      title: "فشل رفع الكتاب",
      message:
        "حصل خطأ غير متوقع في المتصفح أثناء رفع الكتاب. حدّث الصفحة وحاول تاني.",
    };
  }

  const code = err.code;
  const technical = technicalLine(err.details);

  if (code && code in SPECIFIC) {
    return { ...SPECIFIC[code], code, technical };
  }
  if (code === "NETWORK_ERROR" || err.statusCode === 0) {
    return { ...SPECIFIC.NETWORK_ERROR, code: "NETWORK_ERROR" };
  }
  // A gateway/proxy page with no JSON body from our API (so no `code`).
  if (!code && [502, 503, 504].includes(err.statusCode)) {
    return {
      ...SPECIFIC.PROXY_GATEWAY_ERROR,
      technical: `HTTP ${err.statusCode}`,
    };
  }
  if (!code && err.statusCode === 413) {
    return { ...SPECIFIC.FILE_TOO_LARGE, technical: "HTTP 413" };
  }

  return {
    title: (code && TITLES[code]) || "فشل رفع الكتاب",
    message: err.message || "حصل خطأ أثناء رفع المنهج. جرّب تاني.",
    code,
    technical,
  };
}
