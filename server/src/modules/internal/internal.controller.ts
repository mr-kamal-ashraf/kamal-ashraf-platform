import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import * as internalService from "./internal.service";
import * as supportService from "./support.service";
import {
  destroyCurriculumPdfFromBunny,
  uploadQuestionImageToBunny,
} from "../bunny/bunny-storage.service";
import { Curriculum } from "../ai/curriculum.model";
import { describeIngestFailure } from "../ai/curriculum-upload-errors";
import { logger } from "../../shared/utils/logger";
import { env } from "../../config/env";
import {
  aiStatsQuerySchema,
  weeklyBehindDigestQuerySchema,
  supportCatalogQuerySchema,
  ingestStatusQuerySchema,
  type NotifyParentBody,
  type StudentSelfStatsBody,
  type SupportIdentifyBody,
  type SupportStudentContextBody,
  type SupportEscalateBody,
  type SupportSendReplyBody,
  type QuestionImageBody,
  type IngestResultBody,
} from "./internal.validation";

/**
 * Controllers for the n8n-facing /internal routes.
 *
 * These routes DO NOT authenticate a user (there is no cookie session on a
 * server-to-server call). They rely on the requireAutomationSecret middleware
 * to gate access. From this point forward we treat the caller as trusted, but
 * we STILL validate the input shape so a leaked secret cannot crash the server.
 *
 * NOTE on query validation: the shared validate() middleware intentionally
 * does not rewrite req.query (Express 5 makes it read-only), so for query
 * routes we run zod parse() inline in the controller here. Body routes use
 * validate() the same as the rest of the codebase.
 */

/**
 * GET /api/v1/internal/ai-stats?type=X&teacher_id=Y&params=<url_encoded_json>
 * Used by WF5. Returns the shape defined by internal.service.getAiStats.
 */
export async function aiStats(req: Request, res: Response) {
  const q = aiStatsQuerySchema.parse(req.query);
  const data = await internalService.getAiStats(q.type, q.teacher_id, q.params);
  return sendSuccess(res, {
    message: "AI stats",
    data,
  });
}

/**
 * GET /api/v1/internal/weekly-behind-digest?days_threshold=5
 * Used by WF12. Returns { platform_name, teacher_id, days_threshold, students }
 * where each student carries their behind_lessons list. Shape stays
 * WF12-compatible (student_id, parent_id, teacher_id on each student).
 */
export async function weeklyBehindDigest(req: Request, res: Response) {
  const q = weeklyBehindDigestQuerySchema.parse(req.query);
  const digest = await internalService.getWeeklyBehindDigest(q.days_threshold);
  return sendSuccess(res, {
    message: "Weekly behind-lesson digest",
    data: digest,
  });
}

/**
 * POST /api/v1/internal/notify-parent
 * Used by WF8. Enforces the consent gate and (eventually) sends the WhatsApp
 * message. Returns { ok, sent, consent_granted, message } even on refusal so
 * WF8 can log the outcome without treating "consent not granted" as a bug.
 */
export async function notifyParent(req: Request, res: Response) {
  const body = req.body as NotifyParentBody;
  const result = await internalService.notifyParent(body);
  return sendSuccess(res, {
    message: "Parent notification processed",
    data: {
      ok: result.ok,
      sent: result.sent,
      consent_granted: result.consent_granted,
      message: result.message,
      notification_id: body.notification_id,
    },
  });
}

/**
 * POST /api/v1/internal/student-self-stats
 * Used by WF10 (called from WF6 as a tool). Returns the student's own
 * progress + subscription summary. student_id in the body comes from WF6's
 * Normalize Payload (server-side), so a student can never look up another
 * student's data.
 */
export async function studentSelfStats(req: Request, res: Response) {
  const body = req.body as StudentSelfStatsBody;
  const data = await internalService.getStudentSelfStats(body);
  return sendSuccess(res, {
    message: "Student self stats",
    data,
  });
}


// ── WhatsApp support agent tool controllers ─────────────────────────

/**
 * POST /api/v1/internal/support/identify
 * Body: { teacher_id, phone }. Resolves a WhatsApp number to the student(s)/
 * parent it belongs to. Returns { found, contacts }.
 */
export async function supportIdentify(req: Request, res: Response) {
  const body = req.body as SupportIdentifyBody;
  if (body.teacher_id !== env.PLATFORM_TEACHER_ID) {
    return sendSuccess(res, { message: "Identify contact", data: { found: false, contacts: [] } });
  }
  const data = await supportService.identifyContact(body.phone);
  return sendSuccess(res, { message: "Identify contact", data });
}

/**
 * GET /api/v1/internal/support/catalog?teacher_id=...
 * Public course catalog (title, stage, price) for the agent to answer general
 * "what courses / how much" questions and pitch prospects.
 */
export async function supportCatalog(req: Request, res: Response) {
  const q = supportCatalogQuerySchema.parse(req.query);
  if (q.teacher_id !== env.PLATFORM_TEACHER_ID) {
    return sendSuccess(res, { message: "Catalog", data: { platform_name: "", total: 0, courses: [] } });
  }
  const data = await supportService.getSupportCatalog();
  return sendSuccess(res, { message: "Catalog", data });
}

/**
 * POST /api/v1/internal/support/student-context
 * Body: { teacher_id, student_id }. Returns a known student's owned courses,
 * progress, recent payments and behind-lesson count. student_id must come from
 * a prior identify on the SENDER's own phone.
 */
export async function supportStudentContext(req: Request, res: Response) {
  const body = req.body as SupportStudentContextBody;
  if (body.teacher_id !== env.PLATFORM_TEACHER_ID) {
    return sendSuccess(res, { message: "Student context", data: { found: false } });
  }
  const data = await supportService.getStudentSupportContext(body.student_id);
  return sendSuccess(res, { message: "Student context", data });
}

/**
 * POST /api/v1/internal/support/escalate
 * Body: { teacher_id, from_phone, student_id?, category, summary }. Records an
 * escalation for the admin panel and pings the teacher on WhatsApp.
 */
export async function supportEscalate(req: Request, res: Response) {
  const body = req.body as SupportEscalateBody;
  const data = await supportService.createEscalation({
    teacher_id: body.teacher_id,
    from_phone: body.from_phone,
    student_id: body.student_id ?? null,
    category: body.category,
    summary: body.summary,
  });
  return sendSuccess(res, { message: "Escalation", data });
}

/**
 * POST /api/v1/internal/support/send-reply
 * Body: { teacher_id, to_phone, text }. Sends the agent's reply to the sender
 * over WhatsApp from the platform's own number.
 */
export async function supportSendReply(req: Request, res: Response) {
  const body = req.body as SupportSendReplyBody;
  const data = await supportService.sendSupportReply({
    teacher_id: body.teacher_id,
    to_phone: body.to_phone,
    text: body.text,
  });
  return sendSuccess(res, { message: "Support reply", data });
}

// ── AI indexing pipeline (called by n8n's WF1b) ─────────────────────────

/**
 * POST /api/v1/internal/curriculum/question-image
 * Body: { teacher_id, book_id, page_number, image_index, image_base64, question_label? }
 *
 * Stores ONE question diagram cropped by the indexing pipeline, so a later
 * generated exam can embed the REAL image instead of an AI description of it.
 * Unlike the support-agent routes, a teacher_id mismatch here is rejected
 * outright (403) rather than answered with an empty success body: this is a
 * write with real storage cost, and a silent no-op would hide a real
 * misconfiguration (wrong teacher_id wired into n8n) instead of surfacing it.
 */
export async function uploadQuestionImage(req: Request, res: Response) {
  const body = req.body as QuestionImageBody;
  if (body.teacher_id !== env.PLATFORM_TEACHER_ID) {
    throw ApiError.forbidden(
      "teacher_id doesn't match this platform",
      "TEACHER_ID_MISMATCH",
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(body.image_base64, "base64");
  } catch {
    throw ApiError.badRequest("image_base64 is not valid base64", "INVALID_IMAGE_BASE64");
  }
  if (buffer.length === 0) {
    throw ApiError.badRequest("image_base64 decoded to an empty buffer", "INVALID_IMAGE_BASE64");
  }

  const { publicUrl } = await uploadQuestionImageToBunny(
    body.teacher_id,
    body.book_id,
    body.page_number,
    body.image_index,
    buffer,
  );

  return sendSuccess(res, {
    message: "Question image stored",
    data: { image_url: publicUrl, question_label: body.question_label },
  });
}

/**
 * POST /api/v1/internal/curriculum/ingest-result
 * Body: { teacher_id, book_id, ok, error_code? }
 *
 * WF1 answers the upload immediately and finishes the (possibly very long)
 * indexing in the background; this is how it reports the outcome. Only a row
 * that is still "indexing" is touched, so a late or duplicate callback can
 * never overwrite a result that was already recorded. Always answers 2xx for a
 * well-formed call (including "nothing to update") so n8n never retries it.
 */
export async function curriculumIngestResult(req: Request, res: Response) {
  const body = req.body as IngestResultBody;
  if (body.teacher_id !== env.PLATFORM_TEACHER_ID) {
    throw ApiError.forbidden(
      "teacher_id doesn't match this platform",
      "TEACHER_ID_MISMATCH",
    );
  }

  const filter = {
    teacherId: env.PLATFORM_TEACHER_ID,
    bookId: body.book_id,
    status: "indexing" as const,
    // A result for a run that was cancelled or replaced must not touch the row.
    ...(body.ingestion_id ? { ingestionId: body.ingestion_id } : {}),
  };

  if (body.ok) {
    const row = await Curriculum.findOneAndUpdate(filter, {
      $set: { status: "ready", indexedAt: new Date() },
      $unset: {
        indexingStartedAt: 1,
        errorCode: 1,
        errorMessage: 1,
        ingestionId: 1,
        previous: 1,
      },
    });
    // A finished replacement supersedes the PDF of the book it replaced (every
    // upload has its own URL). `row` is the document as it was before the update.
    const superseded = row?.previous?.fileUrl;
    if (row && superseded && superseded !== row.fileUrl) {
      await destroyCurriculumPdfFromBunny(superseded);
    }
    return sendSuccess(res, {
      message: "Indexing result recorded",
      data: { updated: Boolean(row) },
    });
  }

  const failure = describeIngestFailure(body.error_code);
  logger.warn("[internal] curriculum indexing failed", {
    bookId: body.book_id,
    n8nErrorCode: body.error_code,
    code: failure.code,
  });
  const row = await Curriculum.findOneAndUpdate(filter, {
    $set: {
      status: "failed",
      errorCode: failure.code,
      errorMessage: failure.message,
    },
    $unset: { indexingStartedAt: 1, ingestionId: 1, previous: 1 },
  });
  // The cold copy of a book that never got indexed is just an orphan — and so
  // is the one of the book it was meant to replace (its chunks are gone too).
  if (row) {
    await destroyCurriculumPdfFromBunny(row.fileUrl);
    const replaced = row.previous?.fileUrl;
    if (replaced && replaced !== row.fileUrl) {
      await destroyCurriculumPdfFromBunny(replaced);
    }
  }

  return sendSuccess(res, {
    message: "Indexing result recorded",
    data: { updated: Boolean(row) },
  });
}

/**
 * GET /api/v1/internal/curriculum/ingest-status?teacher_id&book_id&ingestion_id
 *
 * WF1 and the OCR service call this while they work to find out whether the
 * admin cancelled (or replaced) the upload. A run is wanted only while the
 * book's row is still "indexing" for exactly that ingestion_id.
 */
export async function curriculumIngestStatus(req: Request, res: Response) {
  const q = ingestStatusQuerySchema.parse(req.query);
  if (q.teacher_id !== env.PLATFORM_TEACHER_ID) {
    return sendSuccess(res, { message: "Ingest status", data: { wanted: false } });
  }
  const row = await Curriculum.findOne({
    teacherId: env.PLATFORM_TEACHER_ID,
    bookId: q.book_id,
    status: "indexing",
    ingestionId: q.ingestion_id,
  })
    .select("_id")
    .lean();
  return sendSuccess(res, { message: "Ingest status", data: { wanted: Boolean(row) } });
}
