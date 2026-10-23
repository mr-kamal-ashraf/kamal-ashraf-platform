import crypto from "crypto";
import fs from "fs";
import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import {
  generateExam,
  listExams,
  getExam,
  deleteExam,
} from "./exam.service";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { env } from "../../config/env";
import { logger } from "../../shared/utils/logger";
import * as aiService from "./ai.service";
import { startAiJob, waitForJob } from "./ai-jobs.service";
import {
  assertIngestSucceeded,
  stalledIngestMessage,
  toBunnyUploadApiError,
  uploadError,
} from "./curriculum-upload-errors";
import { User } from "../users/user.model";
import { Admin } from "../admins/admin.model";
import { Curriculum, isIndexingStalled, type ICurriculum } from "./curriculum.model";
import { STAGE_LABELS } from "../../config/constants";
import { destroyCloudinaryCurriculumByUrl } from "../cloudinary/cloudinary.service";
import {
  isBunnyStorageConfigured,
  uploadCurriculumPdfToBunny,
  destroyCurriculumPdfFromBunny,
} from "../bunny/bunny-storage.service";
import type {
  StudentChatInput,
  ChatHistoryQueryInput,
  UploadCurriculumInput,
  GenerateExamInput,
} from "./ai.validation";

/**
 * POST /api/v1/ai/student-chat
 * Student-only. Sends the student's message to n8n WF6 and returns the reply.
 *
 * SECURITY:
 *   - student_id is req.user.id (from JWT session), NEVER from client body.
 *   - teacher_id is env.PLATFORM_TEACHER_ID (single-tenant).
 *   - A student cannot impersonate another student or address a different
 *     teacher's curriculum — both ids are set server-side.
 *   - was_blocked=true responses (the WF6 solve-request guardrail) are passed
 *     through so the frontend can show a distinct UI hint if desired.
 */
export async function studentChat(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = req.body as StudentChatInput;
  const studentId = req.user.id;

  // `?async=1`: answer at once with a job id and keep working in the
  // background (the browser then asks for the result with short requests).
  // Without it the request behaves exactly as before, so an older frontend
  // keeps working during a deploy.
  if (req.query.async === "1") {
    const jobId = await startAiJob({
      kind: "student_chat",
      ownerId: studentId,
      // n8n's default when the client sends none (see WF6 "Normalize Payload").
      conversationId: input.conversation_id ?? `student_${studentId}`,
      work: () => runStudentChat(studentId, input, { retryUnreachable: true }),
    });
    return sendSuccess(res, {
      statusCode: 202,
      message: "اتبعت سؤالك للمساعد.",
      data: { job_id: jobId, status: "running" },
    });
  }

  return sendSuccess(res, {
    message: "تم الرد",
    data: await runStudentChat(studentId, input),
  });
}

/** What a finished student-chat request returns, inline or as a job's result. */
interface StudentChatResult {
  reply: string;
  conversation_id: string | null;
  was_blocked: boolean;
}

/** Asks WF6 and shapes its answer; throws a clean ApiError when it fails. */
async function runStudentChat(
  studentId: string,
  input: StudentChatInput,
  n8nOptions?: aiService.N8nCallOptions,
): Promise<StudentChatResult> {
  // Fetch the student's name + stage so the AI can personalize the reply.
  // Also fetch the single admin's name so the AI can refer to "your teacher X".
  const [student, admin] = await Promise.all([
    User.findById(studentId)
      .select("firstName secondName thirdName stage")
      .lean(),
    Admin.findOne().select("name").sort({ createdAt: 1 }).lean(),
  ]);

  const fullName = student
    ? `${student.firstName} ${student.secondName} ${student.thirdName}`.trim()
    : undefined;

  const result = await aiService.callStudentChat(
    {
      student_id: studentId,
      teacher_id: env.PLATFORM_TEACHER_ID,
      message: input.message,
      conversation_id: input.conversation_id,
      student_first_name: student?.firstName,
      student_full_name: fullName,
      student_stage: student?.stage,
      teacher_name: admin?.name,
    },
    n8nOptions,
  );

  if (result.ok !== true) {
    if (result.error_code === "RATE_LIMIT_EXCEEDED") {
      throw new ApiError(
        429,
        "المساعد الذكي وصل للحد الأقصى للرسائل دلوقتي، حاول تاني بعدين.",
        {
          code: "AI_RATE_LIMIT",
        },
      );
    }
    throw new ApiError(500, "حصلت مشكلة في رد المساعد الذكي، حاول تاني.", {
      code: "AI_UPSTREAM_ERROR",
    });
  }

  return {
    reply: result.reply ?? "",
    conversation_id: result.conversation_id ?? null,
    was_blocked: Boolean(result.was_blocked),
  };
}

/** `?wait=` in milliseconds (how long a "is it done?" request may hold on). */
function requestedWaitMs(req: Request): number {
  const wait = Number(req.query.wait);
  return Number.isFinite(wait) && wait > 0 ? wait : 0;
}

/**
 * GET /api/v1/ai/student-chat/jobs/:jobId
 * Student-only. The state of a chat request started with `?async=1`:
 * running / done (with the reply) / failed (with the reason). `?wait=<ms>` holds
 * the request until the job finishes or the wait runs out (long polling), so a
 * slow answer costs the browser a few requests, not hundreds. The HTTP status
 * is 200 even for a failed job: a failed job is a normal answer to this request.
 */
export async function getStudentChatJob(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const job = await waitForJob({
    kind: "student_chat",
    ownerId: req.user.id,
    jobId: String(req.params.jobId ?? ""),
    waitMs: requestedWaitMs(req),
  });
  if (!job) {
    throw ApiError.notFound(
      "مش لاقيين الطلب ده — ممكن يكون خلص من فترة. ابعت سؤالك تاني.",
      "AI_JOB_NOT_FOUND",
    );
  }
  return sendSuccess(res, { message: "حالة الطلب", data: job });
}

/**
 * GET /api/v1/ai/student-chat/history
 * Student-only. Returns this student's own chat history so the frontend can
 * repopulate the panel whenever the student opens it — messages are no
 * longer kept only in React state.
 *
 * If ?conversation_id is given, returns exactly that thread (used right
 * after "new chat" picks a fresh id, so the panel can confirm it's empty).
 * Otherwise returns whichever thread is this student's most recent one.
 */
export async function getChatHistory(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = req.query as unknown as ChatHistoryQueryInput;

  const result = await aiService.getStudentChatHistory(
    req.user.id,
    input.conversation_id,
  );

  return sendSuccess(res, {
    message: "سجل المحادثة",
    data: result,
  });
}

/**
 * DELETE /api/v1/ai/student-chat/history
 * Student-only. Permanently wipes EVERY message this student has ever
 * exchanged with the AI tutor, across all conversation threads — used by the
 * chat panel's "مسح كل الرسائل" action so the student can test from a clean
 * slate.
 */
export async function clearChatHistory(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const result = await aiService.clearStudentChatHistory(req.user.id);
  return sendSuccess(res, {
    message: "تم مسح المحادثة",
    data: result,
  });
}

type LeanCurriculum = ICurriculum & { _id: unknown };

/**
 * Undo the "indexing" row written just before n8n was called, when n8n turns
 * out not to have accepted the book: a brand-new book disappears again, a
 * replaced one goes back to what it was.
 */
async function restoreCurriculumRow(
  previous: LeanCurriculum | null,
  bookId: string,
): Promise<void> {
  const filter = { teacherId: env.PLATFORM_TEACHER_ID, bookId };
  try {
    if (!previous) {
      await Curriculum.deleteOne(filter);
      return;
    }
    const set: Record<string, unknown> = {
      bookVersion: previous.bookVersion,
      fileUrl: previous.fileUrl,
      subject: previous.subject,
      grade: previous.grade,
      stage: previous.stage,
      indexedAt: previous.indexedAt,
      status: previous.status ?? "ready",
    };
    const unset: Record<string, 1> = { indexingStartedAt: 1, ingestionId: 1, previous: 1 };
    if (previous.errorCode) set.errorCode = previous.errorCode;
    else unset.errorCode = 1;
    if (previous.errorMessage) set.errorMessage = previous.errorMessage;
    else unset.errorMessage = 1;
    await Curriculum.updateOne(filter, { $set: set, $unset: unset });
  } catch (err) {
    logger.error("[ai.controller] could not restore the curriculum row", { err, bookId });
  }
}

/**
 * POST /api/v1/ai/upload-curriculum
 * Admin-only. Registers a PDF as curriculum content the AI can retrieve from.
 *
 * NEW pipeline (post-Cloudinary):
 *   1. Multer saves the PDF to a local temp path and verifyUploadedPdf
 *      confirms it's actually a PDF (magic bytes) and within the size cap.
 *   2. We upload a persistent copy to Bunny Storage so the admin panel can
 *      later hand out a "فتح الرابط الأصلي" link. This copy is NOT what
 *      the AI indexes — it's cold storage for the UI's benefit only.
 *   3. We stream the SAME file binary DIRECTLY to n8n's /pdf-ingest webhook
 *      as multipart/form-data. WF1 reads it straight off the request — no
 *      more URL fetch, no more small-file caps, no wasted round-trip.
 *   4. On success we upsert a Curriculum row so the admin panel can list /
 *      delete / replace the book without having to enumerate n8n.
 *   5. If n8n fails, we roll back the Bunny upload so we don't leak storage
 *      on failed ingestion attempts.
 */
export async function uploadCurriculum(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = req.body as UploadCurriculumInput;
  const file = (req as Request & { file?: Express.Multer.File }).file;

  if (!file) {
    throw ApiError.badRequest("لازم ترفع ملف PDF", "FILE_REQUIRED");
  }

  if (!isBunnyStorageConfigured()) {
    fs.unlink(file.path, () => undefined);
    throw uploadError("BUNNY_STORAGE_NOT_CONFIGURED");
  }

  let bunnyPublicUrl: string | null = null;
  // The row as it was before this upload, so a failed start can put it back.
  let previousRow: LeanCurriculum | null = null;

  try {
    // A book that is still being indexed in the background must not be
    // replaced underneath n8n — its chunks would be written after we returned.
    previousRow = await Curriculum.findOne({
      teacherId: env.PLATFORM_TEACHER_ID,
      bookId: input.book_id,
    }).lean();
    // A book_id that already exists may only be reused by the explicit
    // "replace" action — never silently overwritten by typing the id again.
    if (previousRow && !input.replace) {
      throw uploadError("BOOK_ID_EXISTS");
    }
    if (!previousRow && input.replace) {
      throw ApiError.notFound(
        "الكتاب اللي بتحاول تستبدله مش موجود (ممكن يكون اتحذف). حدّث الصفحة وحاول تاني.",
        "CURRICULUM_NOT_FOUND",
      );
    }
    if (previousRow && previousRow.status === "indexing" && !isIndexingStalled(previousRow)) {
      throw uploadError("CURRICULUM_INDEXING");
    }

    // Step 1 — persistent copy on Bunny Storage (for the "open original"
    // admin UI link). Do this BEFORE calling n8n so a row on success is
    // guaranteed to have a working fileUrl.
    let publicUrl: string;
    try {
      ({ publicUrl } = await uploadCurriculumPdfToBunny(
        env.PLATFORM_TEACHER_ID,
        input.book_id,
        file.path,
      ));
    } catch (err) {
      throw toBunnyUploadApiError(err);
    }
    bunnyPublicUrl = publicUrl;

    // Subject is a per-platform constant (see PLATFORM_SUBJECT), not
    // something the teacher retypes on every book — bind it here so both
    // the vector store and the local Curriculum row stay consistent.
    const subject = env.PLATFORM_SUBJECT;

    // The Arabic label is presentation only — derived here from the stage the
    // teacher picked so the two can never disagree.
    const grade = STAGE_LABELS[input.stage];

    // Names this run. n8n tags every chunk with it and asks the platform
    // whether it is still wanted, which is what makes cancelling possible.
    const ingestionId = `${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;

    // Step 2 — the row goes in FIRST, as "indexing". n8n reports the result
    // through POST /internal/curriculum/ingest-result, and a small text book
    // can finish before this request has even returned — the row has to exist
    // by then or that callback would have nothing to update.
    try {
      await Curriculum.findOneAndUpdate(
        { teacherId: env.PLATFORM_TEACHER_ID, bookId: input.book_id },
        {
          $set: {
            bookVersion: input.book_version,
            fileUrl: publicUrl,
            subject,
            grade,
            stage: input.stage,
            status: "indexing",
            indexingStartedAt: new Date(),
            ingestionId,
            // Replacing a finished book: remember it so cancelling can put it back.
            ...(previousRow
              ? {
                  previous: {
                    bookVersion: previousRow.bookVersion,
                    fileUrl: previousRow.fileUrl,
                    subject: previousRow.subject,
                    grade: previousRow.grade,
                    stage: previousRow.stage,
                    indexedAt: previousRow.indexedAt,
                    status: previousRow.status ?? "ready",
                    errorCode: previousRow.errorCode,
                    errorMessage: previousRow.errorMessage,
                  },
                }
              : {}),
          },
          $unset: {
            errorCode: 1,
            errorMessage: 1,
            ...(previousRow ? {} : { previous: 1 }),
          },
        },
        { upsert: true, new: true },
      );
    } catch (err) {
      logger.error("[ai.controller] saving the curriculum row failed", { err });
      throw uploadError("CURRICULUM_SAVE_FAILED");
    }

    // Step 3 — stream the binary straight to n8n WF1.
    let result: aiService.N8nSuccessBody;
    try {
      result = await aiService.callPdfIngest({
        teacher_id: env.PLATFORM_TEACHER_ID,
        book_id: input.book_id,
        book_version: input.book_version,
        file_url: publicUrl, // forwarded to n8n's audit log only
        subject,
        grade,
        stage: input.stage,
        ingestion_id: ingestionId,
        file_path: file.path, // the ACTUAL bytes n8n will index
      });
      // callPdfIngest already throws a specific error for every transport/HTTP
      // failure. This catches n8n answering 200 with an empty or `ok:false` body.
      assertIngestSucceeded(result);
    } catch (err) {
      await restoreCurriculumRow(previousRow, input.book_id);
      throw err;
    }

    // WF1 answers right away with status "processing" and reports the outcome
    // later. An older WF1 answers only when it has finished, so in that case
    // the book is already indexed.
    const stillIndexing = result.status === "processing";
    if (!stillIndexing) {
      await Curriculum.updateOne(
        { teacherId: env.PLATFORM_TEACHER_ID, bookId: input.book_id },
        {
          $set: { status: "ready", indexedAt: new Date() },
          $unset: { indexingStartedAt: 1, ingestionId: 1, previous: 1 },
        },
      ).catch((err) =>
        logger.error("[ai.controller] marking the book ready failed", { err }),
      );
      // The replaced book's PDF is superseded now (its URL differs: every
      // upload gets its own path).
      if (previousRow && previousRow.fileUrl !== publicUrl) {
        await destroyCurriculumPdfFromBunny(previousRow.fileUrl);
      }
    }

    return sendSuccess(res, {
      statusCode: stillIndexing ? 202 : 201,
      message: stillIndexing
        ? "اتبعت الكتاب للفهرسة، وهتتابعها من القايمة."
        : "تم رفع المنهج ومعالجته بنجاح.",
      data: {
        book_id: input.book_id,
        book_version: input.book_version,
        status: stillIndexing ? "indexing" : "ready",
      },
    });
  } catch (err) {
    // Any failure past the Bunny upload leaves an orphan — best-effort clean.
    // Wrapped in its own try so a cleanup failure never masks the real error.
    if (bunnyPublicUrl) {
      await destroyCurriculumPdfFromBunny(bunnyPublicUrl).catch(
        () => undefined,
      );
    }
    throw err;
  } finally {
    // Multer's temp file has done its job (both copies are elsewhere now).
    // Same cleanup convention as adminUploadVideo.
    fs.unlink(file.path, () => undefined);
  }
}

/**
 * POST /api/v1/ai/curriculum/:bookId/cancel-indexing
 * Admin-only. Stops a book that is still being indexed — for an upload that
 * was a mistake. A brand-new book disappears again; a replacement goes back to
 * the version that was there before.
 *
 * Nothing here has to reach into n8n: the run is identified by `ingestionId`,
 * and WF1 / the OCR service keep asking the platform "is this run still
 * wanted?". Once the row no longer matches, the OCR stops within seconds and
 * WF1 deletes whatever chunks that run had already written instead of
 * finishing, and any late result callback is ignored.
 */
export async function cancelCurriculumIndexing(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const bookId = String(req.params.bookId ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(bookId)) {
    throw ApiError.badRequest("رقم الكتاب غير صحيح", "INVALID_BOOK_ID");
  }

  const filter = { teacherId: env.PLATFORM_TEACHER_ID, bookId };
  const row = await Curriculum.findOne(filter).lean();
  if (!row) {
    throw ApiError.notFound("الكتاب غير موجود", "CURRICULUM_NOT_FOUND");
  }
  if (row.status !== "indexing") {
    throw uploadError("CURRICULUM_NOT_INDEXING");
  }

  if (row.previous) {
    // A replacement: put the finished book back as it was.
    const previous = row.previous;
    await Curriculum.updateOne(
      { ...filter, ingestionId: row.ingestionId },
      {
        $set: {
          bookVersion: previous.bookVersion,
          fileUrl: previous.fileUrl,
          subject: previous.subject,
          grade: previous.grade,
          stage: previous.stage,
          indexedAt: previous.indexedAt,
          status: previous.status ?? "ready",
          ...(previous.errorCode ? { errorCode: previous.errorCode } : {}),
          ...(previous.errorMessage ? { errorMessage: previous.errorMessage } : {}),
        },
        $unset: {
          indexingStartedAt: 1,
          ingestionId: 1,
          previous: 1,
          ...(previous.errorCode ? {} : { errorCode: 1 }),
          ...(previous.errorMessage ? { errorMessage: 1 } : {}),
        },
      },
    );
    // The cancelled upload's own PDF is an orphan; the restored book keeps the
    // one it already had.
    if (row.fileUrl !== previous.fileUrl) {
      await destroyCurriculumPdfFromBunny(row.fileUrl);
    }
  } else {
    // A new book: it never existed as far as the admin is concerned.
    await Curriculum.deleteOne({ ...filter, ingestionId: row.ingestionId });
    await destroyCurriculumPdfFromBunny(row.fileUrl).catch(() => undefined);
  }

  logger.info("[ai.controller] curriculum indexing cancelled", {
    bookId,
    ingestionId: row.ingestionId,
    restored: Boolean(row.previous),
  });

  return sendSuccess(res, {
    message: row.previous
      ? "اتلغت الفهرسة ورجع الكتاب للنسخة القديمة."
      : "اتلغت الفهرسة واتشال الكتاب.",
    data: { book_id: bookId, outcome: row.previous ? "restored" : "removed" },
  });
}

/**
 * GET /api/v1/ai/curriculum
 * Admin-only. Lists all curriculum books this teacher has uploaded, most
 * recent first. Used by the admin panel to render the "delete / replace"
 * management view.
 */
export async function listCurriculum(_req: Request, res: Response) {
  const items = await Curriculum.find({ teacherId: env.PLATFORM_TEACHER_ID })
    .sort({ indexedAt: -1 })
    .lean();

  return sendSuccess(res, {
    message: "قائمة المنهج",
    data: {
      items: items.map((it) => {
        // A book whose background run never reported back is shown as failed
        // instead of "indexing" forever.
        const stalled = isIndexingStalled(it);
        const status = stalled ? "failed" : (it.status ?? "ready");
        return {
          book_id: it.bookId,
          book_version: it.bookVersion,
          file_url: it.fileUrl,
          subject: it.subject,
          grade: it.grade,
          stage: it.stage,
          indexed_at: it.indexedAt,
          status,
          indexing_started_at: it.indexingStartedAt ?? null,
          error_code: stalled ? "INGEST_STALLED" : (it.errorCode ?? null),
          error_message: stalled ? stalledIngestMessage() : (it.errorMessage ?? null),
        };
      }),
    },
  });
}

/**
 * DELETE /api/v1/ai/curriculum/:bookId
 * Admin-only. Removes a book from both the local metadata AND the n8n vector
 * store. Order matters: we call n8n first, only remove the local row after
 * the vector-store delete succeeds — that way a mid-flight failure never
 * leaves the admin thinking a book is deleted while chunks remain.
 */
export async function deleteCurriculum(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const bookId = String(req.params.bookId ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(bookId)) {
    throw ApiError.badRequest("رقم الكتاب غير صحيح", "INVALID_BOOK_ID");
  }

  const existing = await Curriculum.findOne({
    teacherId: env.PLATFORM_TEACHER_ID,
    bookId,
  });
  if (!existing) {
    throw ApiError.notFound("الكتاب غير موجود", "CURRICULUM_NOT_FOUND");
  }
  if (existing.status === "indexing" && !isIndexingStalled(existing)) {
    throw uploadError("CURRICULUM_INDEXING");
  }

  const result = await aiService.callPdfDelete({
    teacher_id: env.PLATFORM_TEACHER_ID,
    book_id: bookId,
  });

  if (result.ok !== true) {
    throw new ApiError(500, "حصلت مشكلة أثناء حذف المنهج، حاول تاني.", {
      code: "AI_UPSTREAM_ERROR",
    });
  }

  // Best-effort cleanup of the hosted file. Each destroy() only acts if the
  // URL actually belongs to that provider — so a Bunny-hosted row hits the
  // Bunny branch, a legacy Cloudinary-hosted row hits the Cloudinary branch,
  // and neither ever touches the wrong service. Both are safe to await here.
  await destroyCurriculumPdfFromBunny(existing.fileUrl);
  await destroyCloudinaryCurriculumByUrl(existing.fileUrl);

  await Curriculum.deleteOne({ _id: existing._id });

  return sendSuccess(res, {
    message: "تم حذف المنهج",
    data: { book_id: bookId },
  });
}

/**
 * POST /api/v1/ai/exam-generator
 * Admin-only. Generates a complete exam/quiz paper from the teacher's form
 * input, PERSISTS it, and returns the saved paper (with its id) so the panel
 * can both show it immediately and list it in the teacher's library.
 */
export async function generateExamPaper(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = req.body as GenerateExamInput;

  // `?async=1`: same background-job mode as the student chat — a long
  // generation never has to survive on one open browser connection.
  if (req.query.async === "1") {
    const jobId = await startAiJob({
      kind: "exam",
      ownerId: req.user.id,
      work: async () => ({
        exam: await generateExam(input, { retryUnreachable: true }),
      }),
    });
    return sendSuccess(res, {
      statusCode: 202,
      message: "بدأنا توليد الامتحان.",
      data: { job_id: jobId, status: "running" },
    });
  }

  const exam = await generateExam(input);
  return sendSuccess(res, {
    statusCode: 201,
    message: "تم توليد الامتحان",
    data: { exam },
  });
}

/**
 * GET /api/v1/ai/exam-generator/jobs/:jobId
 * Admin-only. The state of an exam generation started with `?async=1`
 * (same contract as the student-chat job route).
 */
export async function getExamJob(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const job = await waitForJob({
    kind: "exam",
    ownerId: req.user.id,
    jobId: String(req.params.jobId ?? ""),
    waitMs: requestedWaitMs(req),
  });
  if (!job) {
    throw ApiError.notFound(
      "مش لاقيين طلب التوليد ده — ممكن يكون خلص من فترة. ولّد الامتحان تاني.",
      "AI_JOB_NOT_FOUND",
    );
  }
  return sendSuccess(res, { message: "حالة التوليد", data: job });
}

/**
 * GET /api/v1/ai/exams
 * Admin-only. Lists the teacher's saved papers, newest first.
 */
export async function listGeneratedExams(_req: Request, res: Response) {
  const exams = await listExams();
  return sendSuccess(res, {
    message: "قائمة الامتحانات",
    data: { items: exams },
  });
}

/**
 * GET /api/v1/ai/exams/:id
 * Admin-only. Returns one saved paper for viewing / printing.
 */
export async function getGeneratedExam(req: Request, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (!isValidObjectId(id)) {
    throw ApiError.badRequest("رقم الامتحان غير صحيح", "INVALID_EXAM_ID");
  }
  const exam = await getExam(id);
  return sendSuccess(res, { message: "الامتحان", data: { exam } });
}

/**
 * DELETE /api/v1/ai/exams/:id
 * Admin-only. Removes one saved paper from the teacher's library.
 */
export async function deleteGeneratedExam(req: Request, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (!isValidObjectId(id)) {
    throw ApiError.badRequest("رقم الامتحان غير صحيح", "INVALID_EXAM_ID");
  }
  await deleteExam(id);
  return sendSuccess(res, { message: "تم حذف الامتحان", data: { id } });
}
