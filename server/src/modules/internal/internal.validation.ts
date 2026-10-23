import { z } from "zod";

/**
 * Zod schemas for the n8n-facing internal endpoints.
 *
 * These endpoints run server-to-server, protected only by the
 * X-Automation-Secret header. Since they trust the caller, we still validate
 * every field defensively — a leaked secret should not let an attacker crash
 * the server with malformed input.
 */

/**
 * GET /api/v1/internal/ai-stats
 * WF5 calls this with query params.
 */
export const aiStatsQuerySchema = z.object({
  type: z.enum([
    "active_students",
    "at_risk_students",
    "lesson_completion",
    "top_performers",
    "recent_signups",
    "sales_summary",
    // Per-student lookup. params carries { name } | { student_id } | { phone };
    // see statStudentDetail in internal.service.ts for the resolution order.
    "student_detail",
  ]),
  teacher_id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]{1,64}$/),
  params: z.string().optional().default("{}"),
});
export type AiStatsQuery = z.infer<typeof aiStatsQuerySchema>;

/**
 * GET /api/v1/internal/weekly-behind-digest?days_threshold=5
 *
 * Course-ownership version of the lagging sweep. Returns every active student
 * who is behind on a lesson that has been available to them (published AND
 * owned) for >= days_threshold days,
 * with the exact lessons. WF12 calls this weekly.
 */
export const weeklyBehindDigestQuerySchema = z.object({
  days_threshold: z.coerce.number().int().min(0).max(90).default(5),
});
export type WeeklyBehindDigestQuery = z.infer<typeof weeklyBehindDigestQuerySchema>;

/**
 * POST /api/v1/internal/notify-parent
 */
export const notifyParentBodySchema = z.object({
  parent_id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]{1,64}$/),
  student_id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]{1,64}$/),
  teacher_id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]{1,64}$/),
  notification_type: z.enum([
    "lagging",
    "exam_missed",
    "no_activity",
    "assignment_missed",
  ]),
  notification_id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]{1,80}$/),
  message_context: z.record(z.unknown()).default({}),
});
export type NotifyParentBody = z.infer<typeof notifyParentBodySchema>;

/**
 * POST /api/v1/internal/student-self-stats
 *
 * WF10 calls this so the student AI can answer "how am I doing?" queries.
 * student_id is the student's own MongoDB _id — n8n gets it from the
 * WF6 Normalize Payload (which itself gets it from the authenticated
 * frontend request), so a student can never look up someone else's stats.
 *
 * teacher_id is passed through for the multi-tenancy check (the backend
 * ensures the student actually belongs to this teacher before returning data).
 */
export const studentSelfStatsBodySchema = z.object({
  student_id: z
    .string()
    .trim()
    .min(1)
    .max(64),  // ObjectId hex string, 24 chars
  teacher_id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]{1,64}$/),
});
export type StudentSelfStatsBody = z.infer<typeof studentSelfStatsBodySchema>;


// ── WhatsApp support agent tools ─────────────────────────────────────

const teacherIdField = z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]{1,64}$/);

/** POST /internal/support/identify  { teacher_id, phone } */
export const supportIdentifyBodySchema = z.object({
  teacher_id: teacherIdField,
  phone: z.string().trim().min(5).max(20),
});
export type SupportIdentifyBody = z.infer<typeof supportIdentifyBodySchema>;

/** GET /internal/support/catalog?teacher_id=... */
export const supportCatalogQuerySchema = z.object({
  teacher_id: teacherIdField,
});
export type SupportCatalogQuery = z.infer<typeof supportCatalogQuerySchema>;

/** POST /internal/support/student-context  { teacher_id, student_id } */
export const supportStudentContextBodySchema = z.object({
  teacher_id: teacherIdField,
  student_id: z.string().trim().min(1).max(64),
});
export type SupportStudentContextBody = z.infer<typeof supportStudentContextBodySchema>;

/** POST /internal/support/escalate  { teacher_id, from_phone, student_id?, category, summary } */
export const supportEscalateBodySchema = z.object({
  teacher_id: teacherIdField,
  from_phone: z.string().trim().min(5).max(20),
  student_id: z.string().trim().max(64).optional(),
  category: z.enum(["payment", "complaint", "question", "other"]),
  summary: z.string().trim().min(1).max(2000),
});
export type SupportEscalateBody = z.infer<typeof supportEscalateBodySchema>;

/** POST /internal/support/send-reply  { teacher_id, to_phone, text } */
export const supportSendReplyBodySchema = z.object({
  teacher_id: teacherIdField,
  to_phone: z.string().trim().min(5).max(20),
  text: z.string().trim().min(1).max(4096),
});
export type SupportSendReplyBody = z.infer<typeof supportSendReplyBodySchema>;

/**
 * POST /internal/curriculum/question-image
 * { teacher_id, book_id, page_number, image_index, image_base64, question_label? }
 * Called by n8n's WF1b indexing pipeline for each diagram it crops out of a
 * curriculum page, so it can be stored and later reused verbatim in a
 * generated exam instead of just described in text.
 */
export const questionImageBodySchema = z.object({
  teacher_id: teacherIdField,
  book_id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]{1,64}$/),
  page_number: z.coerce.number().int().min(1),
  // Index among the images cropped from THIS page (0, 1, 2, ...) — one page
  // can carry several question images (e.g. a row of small icons).
  image_index: z.coerce.number().int().min(0),
  // PNG bytes, base64-encoded (no data: URL prefix).
  image_base64: z.string().trim().min(1),
  // Best-effort label of the question this image belongs to (e.g. "٢" or
  // "Q3") when the detector could read one. Not required — some images are
  // ambiguous or the page has no clear numbering.
  question_label: z.string().trim().max(60).optional().default(""),
});
export type QuestionImageBody = z.infer<typeof questionImageBodySchema>;

/**
 * POST /internal/curriculum/ingest-result — n8n's WF1 reports how a background
 * indexing run ended. `ok:false` carries WF1's own error_code (OCR_FAILED,
 * OCR_NO_TEXT, WORKFLOW_FAILED, ...), which the controller turns into the
 * Arabic explanation the admin sees on the book card.
 */
export const ingestResultBodySchema = z.object({
  teacher_id: teacherIdField,
  book_id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]{1,64}$/),
  ok: z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]),
  error_code: z.string().trim().max(60).optional(),
  // The run this result belongs to. Optional only for older WF1 versions; when
  // present, a result for any other run (cancelled, replaced) is ignored.
  ingestion_id: z.string().trim().max(80).optional(),
});
export type IngestResultBody = z.infer<typeof ingestResultBodySchema>;

/** GET /internal/curriculum/ingest-status — "is this indexing run still wanted?" */
export const ingestStatusQuerySchema = z.object({
  teacher_id: teacherIdField,
  book_id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]{1,64}$/),
  ingestion_id: z.string().trim().min(1).max(80),
});
