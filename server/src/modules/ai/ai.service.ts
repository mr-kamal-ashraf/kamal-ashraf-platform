import { createReadStream, type ReadStream } from "fs";
import fs from "fs/promises";
import FormData from "form-data";
import axios, { AxiosError, type AxiosInstance } from "axios";
import { env } from "../../config/env";
import { ApiError } from "../../shared/utils/ApiError";
import { logger } from "../../shared/utils/logger";
import { withSafeRetry } from "../../shared/utils/safeRetry";
import { freshConnections } from "../../shared/utils/freshConnections";
import { toIngestApiError } from "./curriculum-upload-errors";
import { ChatMessage } from "./chat-message.model";

/**
 * Thin HTTP client for calling n8n webhook endpoints.
 *
 * All n8n webhooks live under one base URL (env.N8N_WEBHOOK_BASE_URL) and are
 * authenticated with a shared secret sent in the X-Automation-Secret header.
 * That secret lives ONLY on the server — never in the frontend or in any
 * response body — so an attacker cannot bypass this proxy by calling n8n directly.
 */

/**
 * Shape of the JSON envelope every n8n workflow returns on success.
 * Some fields are workflow-specific (reply, draft_id, indexed) — but every
 * workflow always includes `ok: boolean`. The controller trusts `ok` to
 * decide whether the underlying automation succeeded.
 */
export interface N8nSuccessBody {
  ok: boolean;
  reply?: string;
  conversation_id?: string;
  was_blocked?: boolean;
  error_code?: string;
  message?: string;
  [k: string]: unknown;
}

/**
 * n8n can answer a webhook with an object or a single-item array, depending
 * on the webhook response mode. Keep that transport detail at this boundary.
 */
function normalizeWebhookBody(data: unknown): N8nSuccessBody | Record<string, never> {
  if (Array.isArray(data) && data.length === 1 && isRecord(data[0])) {
    return data[0] as N8nSuccessBody;
  }
  return isRecord(data) ? (data as N8nSuccessBody) : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Reusable axios instance with the shared secret baked in. Every call gets
// the header automatically — no code path can accidentally omit it.
const n8nHttp: AxiosInstance = axios.create({
  ...freshConnections,
  baseURL: env.N8N_WEBHOOK_BASE_URL,
  timeout: 60_000,  // 60s: chat + retrieval + LLM can take a while
  headers: {
    "X-Automation-Secret": env.AUTOMATION_SECRET,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * Turn any axios failure (network, timeout, non-2xx) into a normalized ApiError.
 * We DO NOT surface n8n's internal error messages verbatim to the frontend —
 * they may leak secret paths or internal ids. Log the raw error server-side,
 * return a generic "AI service unavailable" to the client.
 */
function toApiError(err: unknown, contextLabel: string): ApiError {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<unknown>;
    logger.error(`[ai.service] ${contextLabel} failed`, {
      status: ax.response?.status,
      code: ax.code,
      // Body is intentionally not logged to keep PII out of logs on high-noise setups.
    });
    if (ax.response?.status === 401) {
      // Secret mismatch — dev misconfiguration, not client's fault.
      return new ApiError(500, "المساعد الذكي مش متاح حالياً، حاول تاني بعدين.", {
        code: "AI_BACKEND_UNAUTHORIZED",
      });
    }
    if (ax.response?.status === 402) {
      // This platform's AI wallet is empty (or the platform is paused) — the
      // owner has to top it up. Not a transient fault, so don't suggest retrying.
      return new ApiError(
        402,
        "رصيد الذكاء الاصطناعي للمنصة خلص. تواصل مع إدارة المنصة لشحن الرصيد.",
        { code: "AI_OUT_OF_CREDIT" },
      );
    }
    if (ax.response?.status === 429) {
      return new ApiError(429, "AI rate limit reached, try again later", {
        code: "AI_RATE_LIMIT",
      });
    }
    return new ApiError(500, "المساعد الذكي مش متاح دلوقتي، حاول تاني بعد شوية.", {
      code: "AI_UPSTREAM_ERROR",
    });
  }
  logger.error(`[ai.service] ${contextLabel} unexpected error`, { err });
  return new ApiError(500, "حصلت مشكلة في المساعد الذكي، حاول تاني.", { code: "AI_UPSTREAM_ERROR" });
}

/**
 * True when a failure is just "the caller went away", not a real fault.
 *
 * Kept separate from toApiError because an abort must NOT be logged as an
 * error or reported to the client — by the time it happens the client is
 * already gone, and there is nothing to report or fix.
 */
export function isAbortedRequest(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (axios.isAxiosError(err) && err.code === "ERR_CANCELED") return true;
  return err instanceof Error && err.name === "AbortError";
}

/**
 * The platform waits for n8n's answer for as long as n8n is working on it
 * (axios: 0 = no time limit). A question that needs several curriculum searches
 * or a long exam can take minutes, and cutting the wait early only produces an
 * error although n8n goes on to finish — and charge for — the work.
 *
 * Giving up on a dead n8n is the job of the TCP layer instead of a clock: every
 * request socket carries keep-alive probes (axios turns them on, see
 * freshConnections.ts), so a connection that carries no bytes for minutes is
 * kept open through firewalls and NAT, and one whose other end is really gone
 * fails with a connection error.
 */
const WAIT_FOR_N8N = 0;

/** Options for the calls that can run as background jobs. */
export interface N8nCallOptions {
  /** Retry (with waits) when n8n could not be reached at all — see safeRetry.ts. */
  retryUnreachable?: boolean;
}

/**
 * POST /webhook/student-chat  (WF6)
 * student_id AND teacher_id both come from server-side identity resolution,
 * NOT from the request body.
 */
export async function callStudentChat(
  input: {
    student_id: string;
    teacher_id: string;
    message: string;
    conversation_id?: string;
    student_first_name?: string;
    student_full_name?: string;
    student_stage?: string;
    teacher_name?: string;
  },
  options: N8nCallOptions = {},
): Promise<N8nSuccessBody> {
  try {
    const post = () =>
      n8nHttp.post<N8nSuccessBody>(
        "/student-chat",
        {
          student_id: input.student_id,
          teacher_id: input.teacher_id,
          message: input.message,
          platform_api_host: env.PLATFORM_API_HOST,
          // Tell the assistant which platform/subject it lives on, so it never has
          // to ask the student "which subject?" — this platform teaches one subject.
          platform_subject: env.PLATFORM_SUBJECT,
          // The platform's own identity/mission for the assistant (required env).
          ai_instructions: env.PLATFORM_AI_INSTRUCTIONS,
          ...(input.conversation_id
            ? { conversation_id: input.conversation_id }
            : {}),
          ...(input.student_first_name
            ? { student_first_name: input.student_first_name }
            : {}),
          ...(input.student_full_name
            ? { student_full_name: input.student_full_name }
            : {}),
          ...(input.student_stage
            ? { student_stage: input.student_stage }
            : {}),
          ...(input.teacher_name ? { teacher_name: input.teacher_name } : {}),
        },
        { timeout: WAIT_FOR_N8N },
      );
    const { data } = await (options.retryUnreachable
      ? withSafeRetry("student-chat", post)
      : post());
    return data;
  } catch (err) {
    throw toApiError(err, "student-chat");
  }
}

/**
 * POST /webhook/exam-generator
 *
 * Generates a set of exam questions grounded ONLY in the teacher's uploaded
 * curriculum. The workflow retrieves the relevant curriculum chunks (WF2) for
 * the given book/stage and topic, then has the model write questions from that
 * content alone — never from its own general knowledge.
 *
 * The teacher's own hand-written questions are NOT sent here: the controller
 * appends them to the paper verbatim, because they may be questions that are
 * deliberately outside the uploaded curriculum.
 */
export interface ExamGenQuestion {
  question_type?: string;
  question_text?: string;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
  source_reference?: string;
}

export interface ExamGenBody extends N8nSuccessBody {
  /** true when no curriculum content matched — the caller must not fabricate. */
  no_content?: boolean;
  exam?: {
    exam_title?: string;
    instructions?: string | string[];
    questions?: ExamGenQuestion[];
  };
}

export async function callExamGenerator(
  input: {
    teacher_id: string;
    stage: string;
    topic: string;
    question_count: number;
    difficulty: string;
    /** Comma-separated list, matching WF14's `question_types` field. */
    question_types: string;
    /**
     * Which uploaded books to draw from. Sent to WF14 as a single comma-joined
     * `book_id` field — WF2's retrieval pre-filter splits it and matches any of
     * them ($in), so one paper can span several books. Empty = all of this
     * stage's books.
     */
    book_ids: string[];
  },
  options: N8nCallOptions = {},
): Promise<ExamGenBody> {
  try {
    const bookIdParam = input.book_ids
      .map((id) => id.trim())
      .filter(Boolean)
      .join(",");
    const post = () =>
      n8nHttp.post<unknown>(
        "/exam-generator",
        {
          teacher_id: input.teacher_id,
          stage: input.stage,
          topic: input.topic,
          question_count: input.question_count,
          difficulty: input.difficulty,
          question_types: input.question_types,
          platform_api_host: env.PLATFORM_API_HOST,
          ...(bookIdParam ? { book_id: bookIdParam } : {}),
        },
        // Retrieval + a longer generation can take a while; wait for it.
        { timeout: WAIT_FOR_N8N },
      );
    const { data } = await (options.retryUnreachable
      ? withSafeRetry("exam-generator", post)
      : post());
    return normalizeWebhookBody(data) as ExamGenBody;
  } catch (err) {
    throw toApiError(err, "exam-generator");
  }
}

/**
 * POST /webhook/pdf-ingest  (WF1)
 *
 * The PDF file is streamed DIRECTLY to n8n as multipart/form-data — n8n's
 * WF1 reads it straight off the webhook binary and hands it to the PDF
 * Loader (no more Cloudinary hop, no HEAD+GET dance, no public-URL fetch).
 * That is what removes the small-file cap curriculum PDFs used to hit and
 * cuts a whole round-trip out of the ingestion latency.
 *
 * The bunny-hosted `file_url` is still forwarded as an ordinary form field
 * (not a fetch target) — it lands in the workflow's audit log so admins can
 * later trace which persistent copy backs each indexing run.
 *
 * We use axios directly (not the shared n8nHttp instance) because this call
 * needs a longer timeout and multipart Content-Type — the shared instance is
 * pinned to application/json for the chat endpoints.
 */
export async function callPdfIngest(input: {
  teacher_id: string;
  book_id: string;
  book_version: number;
  file_url: string;
  subject: string;
  grade: string;
  /** Academic year the book belongs to — indexed with every chunk so
   *  retrieval can tell a student when content is from another year. */
  stage: string;
  /** Id of this indexing run, chosen by the platform so it can later tell n8n
   *  (and the OCR service) that the run is no longer wanted. */
  ingestion_id: string;
  /** Absolute path to the local temp file (multer output). Streamed as the
   * "file" part of the multipart request. */
  file_path: string;
}): Promise<N8nSuccessBody> {
  let fileStream: ReadStream | undefined;
  try {
    // Streamed from disk, not read into memory: a 300 MB book used to be held
    // as a buffer AND as a Blob copy while it was sent. `form-data` accepts a
    // file stream, and axios computes the Content-Length from the file size.
    const size = (await fs.stat(input.file_path)).size;
    fileStream = createReadStream(input.file_path);
    const form = new FormData();
    form.append("teacher_id", input.teacher_id);
    form.append("book_id", input.book_id);
    form.append("book_version", String(input.book_version));
    form.append("file_url", input.file_url);
    form.append("subject", input.subject);
    form.append("grade", input.grade);
    form.append("stage", input.stage);
    form.append("ingestion_id", input.ingestion_id);
    form.append("file", fileStream, {
      filename: `${input.teacher_id}_${input.book_id}.pdf`,
      contentType: "application/pdf",
      knownLength: size,
    });

    const { data } = await axios.post<N8nSuccessBody>(
      `${env.N8N_WEBHOOK_BASE_URL}/pdf-ingest`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          "X-Automation-Secret": env.AUTOMATION_SECRET,
          Accept: "application/json",
        },
        // PDF ingestion (chunk + embed + store) can take much longer than a
        // chat reply, and a scanned book is OCR'd page by page on top of that —
        // wait for n8n however long that takes.
        timeout: WAIT_FOR_N8N,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        // Without this axios keeps a copy of every body chunk for redirects,
        // which puts the whole PDF back into memory (see bunny-storage.service).
        maxRedirects: 0,
        ...freshConnections,
      },
    );
    return data;
  } catch (err) {
    // Admin-only call: unlike chat, the admin needs the REAL reason it failed
    // (server down / timeout / out of credit / ...), not one generic message.
    throw toIngestApiError(err);
  } finally {
    // If the request failed before the file was sent (n8n down, refused…) the
    // stream would otherwise stay open until garbage collection.
    fileStream?.destroy();
  }
}

/**
 * POST /webhook/register-platform  (WF11)
 *
 * Fire-and-forget: called once at server startup so n8n's shared `platforms`
 * collection knows this teacher's backend exists and where to reach it
 * (an upsert keyed by teacher_id, so calling it again on every restart is
 * harmless and keeps the recorded host fresh after a redeploy).
 *
 * WF7's daily lagging-student sweep only contacts platforms registered here
 * — skipping this call means WF7 silently never processes this teacher's
 * students. Never throws: startup must never fail just because n8n is
 * briefly unreachable. Retries a few times with a short backoff, then logs
 * an error and gives up.
 */
export async function callRegisterPlatform(): Promise<void> {
  const teacher_id = env.PLATFORM_TEACHER_ID;
  const platform_api_host = env.PLATFORM_API_HOST;
  const platform_name = env.PLATFORM_NAME ?? "";

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data } = await n8nHttp.post<N8nSuccessBody>(
        "/register-platform",
        { teacher_id, platform_api_host, platform_name },
        { timeout: 15_000 },
      );
      if (data?.ok) {
        logger.info(
          `[ai.service] Registered platform with n8n (teacher_id=${teacher_id}, host=${platform_api_host})`,
        );
      } else {
        logger.warn("[ai.service] register-platform responded without ok:true", { data });
      }
      return;
    } catch (err) {
      const isLastAttempt = attempt === maxAttempts;
      // Log the fully-resolved URL and the upstream response body (if any) on
      // top of status/code — a bare 404 is ambiguous (wrong N8N_WEBHOOK_BASE_URL
      // pointing at a dead host vs. n8n itself rejecting the path), and this is
      // the only way to tell them apart from the logs alone.
      logger.warn(`[ai.service] register-platform attempt ${attempt}/${maxAttempts} failed`, {
        error: axios.isAxiosError(err)
          ? {
              status: err.response?.status,
              code: err.code,
              url: (err.config?.baseURL ?? "") + (err.config?.url ?? ""),
              responseData: err.response?.data,
            }
          : err,
      });
      if (isLastAttempt) {
        logger.error(
          "[ai.service] register-platform failed after all attempts — WF7 will not process this platform until this succeeds",
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

/**
 * Reads this student's own chat history straight from the `chatMessages`
 * collection that WF6 writes to (see chat-message.model.ts) — no n8n call,
 * this is a pure DB read.
 *
 * If `conversationId` is given, returns exactly that thread. If omitted, we
 * first find this student's single most recent message to discover their
 * current thread id, then return everything under it — this is what lets a
 * student reopen the chat on a brand new browser/device and still see their
 * ongoing conversation without the frontend having to know the id already.
 *
 * Returns `conversationId: null` and an empty list for a student who has
 * never sent a message.
 */
export async function getStudentChatHistory(
  studentId: string,
  conversationId?: string,
): Promise<{
  conversationId: string | null;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    wasBlocked: boolean;
    createdAt: string;
  }>;
}> {
  let resolvedConversationId = conversationId ?? null;

  if (!resolvedConversationId) {
    const latest = await ChatMessage.findOne({ participantId: studentId })
      .sort({ createdAt: -1 })
      .select("conversationId")
      .lean();
    resolvedConversationId = latest?.conversationId ?? null;
  }

  if (!resolvedConversationId) {
    return { conversationId: null, messages: [] };
  }

  const docs = await ChatMessage.find({
    participantId: studentId,
    conversationId: resolvedConversationId,
  })
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();

  return {
    conversationId: resolvedConversationId,
    messages: docs.map((d) => ({
      id: String(d._id),
      role: d.role,
      content: d.content ?? "",
      wasBlocked: Boolean(d.wasBlocked),
      createdAt: new Date(d.createdAt).toISOString(),
    })),
  };
}

/**
 * Permanently deletes EVERY chat message this student has ever exchanged
 * with the AI tutor, across every conversation thread they've had — a full
 * wipe, not just starting a new thread. Used by the "clear everything"
 * action in the chat panel.
 */
export async function clearStudentChatHistory(
  studentId: string,
): Promise<{ deletedCount: number }> {
  const result = await ChatMessage.deleteMany({ participantId: studentId });
  return { deletedCount: result.deletedCount ?? 0 };
}

/**
 * POST /webhook/pdf-delete  (WF9)
 * Admin deletes a previously uploaded curriculum book. n8n removes ALL its
 * chunks from Atlas Vector Search filtered by (teacher_id, book_id). The
 * caller (controller) is expected to remove the local metadata row as well.
 */
export async function callPdfDelete(input: {
  teacher_id: string;
  book_id: string;
}): Promise<N8nSuccessBody> {
  try {
    const { data } = await n8nHttp.post<unknown>(
      "/pdf-delete",
      {
        teacher_id: input.teacher_id,
        book_id: input.book_id,
      },
      // WF9 can take longer than the shared 60s request limit when a book
      // has many vector chunks. Let the workflow return its actual result;
      // otherwise n8n may finish successfully after this server has already
      // told the admin that the AI service was unavailable.
      { timeout: WAIT_FOR_N8N },
    );
    const body = normalizeWebhookBody(data);

    // WF9 ends with a Mongo delete. When no chunks match, Mongo returns no
    // items and n8n can send an empty 2xx response although the webhook
    // completed successfully. A curriculum delete is idempotent, so accept
    // that response instead of reporting a fictitious AI outage.
    if (Object.keys(body).length === 0) {
      logger.warn("[ai.service] pdf-delete completed with an empty webhook body", {
        teacher_id: input.teacher_id,
        book_id: input.book_id,
      });
      return { ok: true };
    }

    return body as N8nSuccessBody;
  } catch (err) {
    throw toApiError(err, "pdf-delete");
  }
}
