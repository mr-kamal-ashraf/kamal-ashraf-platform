import { Router } from "express";
import {
  aiStats,
  weeklyBehindDigest,
  notifyParent,
  studentSelfStats,
  supportIdentify,
  supportCatalog,
  supportStudentContext,
  supportEscalate,
  supportSendReply,
  uploadQuestionImage,
  curriculumIngestResult,
  curriculumIngestStatus,
} from "./internal.controller";
import {
  notifyParentBodySchema,
  studentSelfStatsBodySchema,
  supportIdentifyBodySchema,
  supportStudentContextBodySchema,
  supportEscalateBodySchema,
  supportSendReplyBodySchema,
  questionImageBodySchema,
  ingestResultBodySchema,
} from "./internal.validation";
import { validate } from "../../shared/middlewares/validate.middleware";
import { requireAutomationSecret } from "../../shared/middlewares/automationSecret.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = Router();

/**
 * All routes below are called SERVER-TO-SERVER by n8n. They are protected by a
 * constant-time comparison of the X-Automation-Secret header against
 * env.AUTOMATION_SECRET — no cookie, no JWT.
 *
 * This platform's AUTOMATION_SECRET is its own per-platform secret, stored in
 * its row in n8n's shared `platforms` collection; n8n reads it from there when
 * it calls back here. To rotate it, update this platform's row (its
 * `automationSecret`) and this env var together, in the same maintenance window.
 */
router.use(requireAutomationSecret());

/**
 * GET /api/v1/internal/ai-stats
 * Query: type=<enum>, teacher_id=<string>, params=<url_encoded_json>
 * Called by WF5's HTTP Request node.
 */
router.get("/ai-stats", asyncHandler(aiStats));

/**
 * GET /api/v1/internal/weekly-behind-digest?days_threshold=5
 * Course-ownership version of the lagging sweep. Called by WF12's weekly
 * HTTP Request node. Returns per-student behind-lesson lists.
 */
router.get("/weekly-behind-digest", asyncHandler(weeklyBehindDigest));

/**
 * POST /api/v1/internal/notify-parent
 * Called by WF8's HTTP Request node. Body validated against notifyParentBodySchema.
 */
router.post(
  "/notify-parent",
  validate(notifyParentBodySchema),
  asyncHandler(notifyParent),
);

/**
 * POST /api/v1/internal/student-self-stats
 * Called by WF10 (from WF6). Returns the calling student's own progress.
 */
router.post(
  "/student-self-stats",
  validate(studentSelfStatsBodySchema),
  asyncHandler(studentSelfStats),
);

// ── WhatsApp support agent tools (called by the support-agent workflow) ────

/** POST /api/v1/internal/support/identify — resolve a phone to student/parent. */
router.post(
  "/support/identify",
  validate(supportIdentifyBodySchema),
  asyncHandler(supportIdentify),
);

/** GET /api/v1/internal/support/catalog?teacher_id=... — public course catalog. */
router.get("/support/catalog", asyncHandler(supportCatalog));

/** POST /api/v1/internal/support/student-context — a known student's own data. */
router.post(
  "/support/student-context",
  validate(supportStudentContextBodySchema),
  asyncHandler(supportStudentContext),
);

/** POST /api/v1/internal/support/escalate — hand a case to the teacher. */
router.post(
  "/support/escalate",
  validate(supportEscalateBodySchema),
  asyncHandler(supportEscalate),
);

/** POST /api/v1/internal/support/send-reply — send the agent's reply on WhatsApp. */
router.post(
  "/support/send-reply",
  validate(supportSendReplyBodySchema),
  asyncHandler(supportSendReply),
);

// ── AI indexing pipeline (called by n8n's WF1b) ─────────────────────────

/**
 * POST /api/v1/internal/curriculum/question-image — store one question
 * diagram cropped during indexing, so a generated exam can reuse the real
 * image instead of an AI description of it.
 */
router.post(
  "/curriculum/question-image",
  validate(questionImageBodySchema),
  asyncHandler(uploadQuestionImage),
);

/**
 * POST /api/v1/internal/curriculum/ingest-result — WF1 reports how a
 * background indexing run ended (ready or failed + why).
 */
router.post(
  "/curriculum/ingest-result",
  validate(ingestResultBodySchema),
  asyncHandler(curriculumIngestResult),
);

/**
 * GET /api/v1/internal/curriculum/ingest-status — is this indexing run still
 * wanted? (false once the admin cancelled or replaced the upload)
 */
router.get("/curriculum/ingest-status", asyncHandler(curriculumIngestStatus));

export default router;
