import { Router } from "express";
import {
  studentChat,
  getStudentChatJob,
  getChatHistory,
  clearChatHistory,
  uploadCurriculum,
  listCurriculum,
  cancelCurriculumIndexing,
  deleteCurriculum,
  generateExamPaper,
  getExamJob,
  listGeneratedExams,
  getGeneratedExam,
  deleteGeneratedExam,
} from "./ai.controller";
import {
  studentChatSchema,
  chatHistoryQuerySchema,
  uploadCurriculumSchema,
  generateExamSchema,
} from "./ai.validation";
import { validate } from "../../shared/middlewares/validate.middleware";
import {
  authenticateStudent,
  authenticateAdmin,
} from "../../shared/middlewares/auth.middleware";
import { requireCourseOwnership } from "../enrollments/enrollment.middleware";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  curriculumPdfUpload,
  discardAbortedUpload,
  discardUploadOnError,
  verifyUploadedPdf,
} from "../../shared/middlewares/upload.middleware";

const router = Router();

// ── Student-facing route ───────────────────────────────────────────────────────
//
// Chained middleware order matters:
//   1) authenticateStudent — populates req.user.id from the student cookie's JWT
//   2) requireCourseOwnership — buy-course gate: only a student who owns at
//      least one course can use the AI tutor (replaces the old subscription gate)
//   3) validate — parses body against the Zod schema, populates req.body typed
//
// The controller then uses req.user.id (not the body) as the student_id sent to n8n.

/**
 * POST /api/v1/ai/student-chat
 * Send a message to the student AI tutor. Returns { reply, conversation_id, was_blocked }.
 */
router.post(
  "/student-chat",
  authenticateStudent(),
  requireCourseOwnership,
  validate(studentChatSchema),
  asyncHandler(studentChat),
);

/**
 * GET /api/v1/ai/student-chat/jobs/:jobId?wait=<ms>
 * The result of a message sent with `?async=1` (long polling, see the controller).
 * Only the student who sent it can read it.
 */
router.get(
  "/student-chat/jobs/:jobId",
  authenticateStudent(),
  asyncHandler(getStudentChatJob),
);

/**
 * GET /api/v1/ai/student-chat/history
 * Returns this student's chat history so the panel can show past messages
 * on reopen instead of starting blank every time. No course-ownership gate —
 * a student who already has messages should always be able to read them back,
 * even if their access later changed.
 */
router.get(
  "/student-chat/history",
  authenticateStudent(),
  validate(chatHistoryQuerySchema, "query"),
  asyncHandler(getChatHistory),
);

/**
 * DELETE /api/v1/ai/student-chat/history
 * Wipes every message this student has exchanged with the AI tutor, across
 * every thread — the panel's "مسح كل الرسائل" action.
 */
router.delete(
  "/student-chat/history",
  authenticateStudent(),
  asyncHandler(clearChatHistory),
);

// ── Admin (teacher) routes ─────────────────────────────────────────────────────
//
// These use the admin cookie (via authenticateAdmin) so they are completely
// separate from the student cookie namespace. An attacker who steals a student
// cookie cannot hit these endpoints.

/**
 * POST /api/v1/ai/upload-curriculum
 * Admin-only. Teacher uploads a PDF file directly (multipart/form-data,
 * field "file") which gets hosted on Cloudinary and registered with the AI
 * retrieval index. Middleware order mirrors the lesson video/thumbnail
 * routes: multer saves to disk first, then verifyUploadedPdf checks the
 * actual bytes, then validate() parses the remaining text fields.
 */
router.post(
  "/upload-curriculum",
  authenticateAdmin(),
  discardAbortedUpload,
  curriculumPdfUpload.single("file"),
  verifyUploadedPdf,
  validate(uploadCurriculumSchema),
  asyncHandler(uploadCurriculum),
  discardUploadOnError,
);

/**
 * GET /api/v1/ai/curriculum
 * Admin-only. Lists all indexed curriculum books for this teacher.
 */
router.get(
  "/curriculum",
  authenticateAdmin(),
  asyncHandler(listCurriculum),
);

/**
 * POST /api/v1/ai/curriculum/:bookId/cancel-indexing
 * Admin-only. Stops a book that is still being indexed (an upload by mistake).
 */
router.post(
  "/curriculum/:bookId/cancel-indexing",
  authenticateAdmin(),
  asyncHandler(cancelCurriculumIndexing),
);

/**
 * DELETE /api/v1/ai/curriculum/:bookId
 * Admin-only. Removes a book from both the local record and the vector store.
 */
router.delete(
  "/curriculum/:bookId",
  authenticateAdmin(),
  asyncHandler(deleteCurriculum),
);

/**
 * POST /api/v1/ai/exam-generator
 * Admin-only. The "خدمات الـ AI → مولّد الامتحانات" tool: a form in, a finished
 * exam/quiz paper out. The paper is persisted (see the /exams routes below) so
 * the teacher keeps a library they can re-open, print, or delete.
 */
router.post(
  "/exam-generator",
  authenticateAdmin(),
  validate(generateExamSchema),
  asyncHandler(generateExamPaper),
);

/**
 * GET /api/v1/ai/exam-generator/jobs/:jobId?wait=<ms>
 * Admin-only. The result of an exam generation started with `?async=1`.
 */
router.get(
  "/exam-generator/jobs/:jobId",
  authenticateAdmin(),
  asyncHandler(getExamJob),
);

/**
 * GET /api/v1/ai/exams
 * Admin-only. The teacher's saved papers, newest first.
 */
router.get("/exams", authenticateAdmin(), asyncHandler(listGeneratedExams));

/**
 * GET /api/v1/ai/exams/:id
 * Admin-only. One saved paper, for viewing / printing.
 */
router.get("/exams/:id", authenticateAdmin(), asyncHandler(getGeneratedExam));

/**
 * DELETE /api/v1/ai/exams/:id
 * Admin-only. Removes one saved paper from the library.
 */
router.delete(
  "/exams/:id",
  authenticateAdmin(),
  asyncHandler(deleteGeneratedExam),
);

export default router;
