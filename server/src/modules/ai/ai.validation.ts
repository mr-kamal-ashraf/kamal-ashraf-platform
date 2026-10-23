import { z } from "zod";
import { STAGE_VALUES } from "../../config/constants";

/**
 * Zod schemas for the AI-facing routes.
 *
 * These describe the SHAPE the frontend must send. Every AI route is
 * user-authenticated (student or admin JWT), so we NEVER read the user's
 * identity from the request body — the id we forward to n8n comes from
 * req.user.id (populated by the auth middleware), not from anything the
 * client sent. That is the primary anti-spoofing measure.
 */

// Reused across chat schemas: opaque conversation id (frontend supplies for
// continuing a thread, or omits for a new one).
const conversationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]{1,128}$/, "conversation_id must be [a-zA-Z0-9_-]")
  .optional();

// Student message length limit mirrors n8n's WF6 validation (1-1000). Kept in
// sync deliberately.
const studentMessageSchema = z.string().trim().min(1).max(1000);

/**
 * POST /api/v1/ai/student-chat
 * Student-authenticated. Forwards to n8n WF6.
 */
export const studentChatSchema = z.object({
  message: studentMessageSchema,
  conversation_id: conversationIdSchema,
});
export type StudentChatInput = z.infer<typeof studentChatSchema>;

/**
 * GET /api/v1/ai/student-chat/history
 * Student-authenticated. Query-string version of the same opaque id — lets
 * the frontend ask for a specific thread, or omit it to get whichever thread
 * is this student's most recent one.
 */
export const chatHistoryQuerySchema = z.object({
  conversation_id: conversationIdSchema,
});
export type ChatHistoryQueryInput = z.infer<typeof chatHistoryQuerySchema>;

/**
 * POST /api/v1/ai/upload-curriculum
 * Admin-authenticated. Forwards to n8n WF1 for indexing.
 *
 * The teacher uploads the PDF file directly (multipart/form-data — see the
 * curriculumPdfUpload/verifyUploadedPdf middlewares in ai.routes.ts). The
 * controller hosts it on Cloudinary first to get a public HTTPS URL, then
 * forwards that URL to n8n, which downloads, chunks, embeds, and stores it in
 * MongoDB Atlas Vector Search — from that point forward the AI can retrieve
 * from it. Uploading a new version with the same book_id replaces the old one.
 *
 * NOTE: this schema only validates the text fields multer places on req.body —
 * the file itself lives on req.file and is validated separately (MIME +
 * magic bytes) before this schema ever runs.
 */
export const uploadCurriculumSchema = z.object({
  book_id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(
      /^[a-zA-Z0-9_-]{1,64}$/,
      "book_id must be 1-64 chars of [a-zA-Z0-9_-]",
    ),
  // Coerce so the multipart-form string "1" parses cleanly; default to 1 when
  // the field is missing entirely (a fresh upload with no version input).
  book_version: z
    .preprocess(
      (v) => (v === undefined || v === null || v === "" ? undefined : v),
      z.coerce.number().int().positive(),
    )
    .optional()
    .default(1),
  // true ONLY when the admin pressed "استبدال" on an existing book. Anything
  // else that reuses a book_id is rejected, so a book can never be overwritten
  // by accident just because the same id was typed again.
  replace: z
    .preprocess(
      (v) => v === true || v === "true" || v === "1",
      z.boolean(),
    )
    .optional()
    .default(false),
  // subject is NOT accepted from the client — it's baked into the platform's
  // env (PLATFORM_SUBJECT) and the controller fills it in from there. Every
  // book on this teacher's platform teaches the same subject, so asking on
  // every upload is friction with no upside.
  // The academic year this book teaches. REQUIRED: a book with no year can't
  // be matched against a student's year, and unlabelled content would either
  // leak into every year or be invisible to all of them. The human-readable
  // Arabic label is derived from this server-side, so the two can never drift.
  stage: z.enum(STAGE_VALUES, {
    errorMap: () => ({
      message: "اختار مرحلة صحيحة (تالتة إعدادي / أولى ثانوي / تالتة ثانوي)",
    }),
  }),
});
export type UploadCurriculumInput = z.infer<typeof uploadCurriculumSchema>;

/**
 * POST /api/v1/ai/exam-generator
 * Admin-authenticated. Drives the form-based exam generator.
 *
 * Bounds are deliberate: a paper longer than 50 questions or 300 minutes is
 * almost always a typo, and letting one through would burn a long, expensive
 * generation for nothing.
 *
 * `kind` is a label only ("quiz" vs "exam") — it does not change how the paper
 * is built. The platform never produces an answer key, so there is no
 * includeAnswerKey flag: generated papers are questions-only.
 */
export const generateExamSchema = z
  .object({
    // "امتحان" or "كويز" — a label the teacher chooses; same generation either way.
    kind: z.enum(["quiz", "exam"]).default("exam"),
    stage: z.enum(STAGE_VALUES),
    // Which uploaded curriculum books to draw questions from. The teacher may
    // pick several; an empty list means "all of this stage's books".
    bookIds: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(64)
          .regex(/^[a-zA-Z0-9_-]{1,64}$/, "book id must be [a-zA-Z0-9_-]"),
      )
      .max(10)
      .optional()
      .default([]),
    // The chapters/topics to cover — also used as the retrieval query against
    // the uploaded curriculum.
    topics: z.string().trim().min(3).max(500),
    // How many questions the AI generates from the curriculum. Custom teacher
    // questions are added on top of this.
    questionCount: z.coerce.number().int().min(1).max(50),
    questionTypes: z
      .array(z.enum(["mcq", "truefalse", "short", "essay"]))
      .min(1)
      .max(4),
    difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
    durationMinutes: z.coerce.number().int().min(5).max(300).default(60),
    totalMarks: z.coerce.number().int().min(1).max(300).default(50),
    // The teacher's own questions, one per line, added to the paper verbatim.
    // These are NOT sent to the model — they may be questions that are not in
    // the curriculum, and must appear exactly as the teacher wrote them.
    customQuestions: z.string().trim().max(4000).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();
export type GenerateExamInput = z.infer<typeof generateExamSchema>;
