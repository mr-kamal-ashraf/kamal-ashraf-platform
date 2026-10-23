import { apiClient } from "./client";
import { runAsyncJob } from "./asyncJob";
import type { Stage } from "@/shared/lib/stage";

/**
 * Thin API client for the AI endpoints on the Express backend.
 * Every call goes through `apiClient` — cookies are attached automatically,
 * 401 triggers a refresh, and the response envelope is unwrapped for us.
 * The X-Automation-Secret used to reach n8n is added SERVER-SIDE only,
 * never exposed to the browser.
 */

export interface AIChatReply {
  /** The AI's text answer. Always in Arabic unless the student wrote another language. */
  reply: string;
  /** Opaque id we send back on the next call to keep the same conversation thread. */
  conversation_id: string | null;
  /**
   * True when the student chatbot's intent classifier blocked the message
   * (student asked "solve this exercise for me" and got a Socratic-style refusal).
   * The reply itself still contains the refusal text — the flag lets the UI
   * decorate it differently if desired.
   */
  was_blocked?: boolean;
}

export interface AIChatRequest {
  message: string;
  conversation_id?: string;
}

/** One stored message row, as returned by the chat-history endpoint. */
export interface AIChatHistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  wasBlocked: boolean;
  createdAt: string;
}

export interface AIChatHistoryResponse {
  /** null when this student has never sent a message yet. */
  conversation_id: string | null;
  messages: AIChatHistoryMessage[];
}

export interface UploadCurriculumRequest {
  book_id: string;
  book_version?: number;
  /** The PDF file itself — the backend hosts it and forwards the resulting URL to n8n. */
  file: File;
  /**
   * Which academic year this book teaches. Required: the assistant matches it
   * against the asking student's year, so a book without one could not be
   * placed. The Arabic label shown in the UI is derived from this on the
   * backend. (Subject is NOT here — it's a per-platform constant,
   * PLATFORM_SUBJECT.)
   */
  stage: Stage;
  /**
   * Must be true to reuse a book_id that already exists — set only by the
   * "استبدال" action. Without it the backend refuses a duplicate id.
   */
  replace?: boolean;
}

/**
 * Indexing happens in the background (a scanned book can take 30+ minutes), so
 * a book is listed as soon as it is uploaded, while it is still "indexing".
 */
export type CurriculumStatus = "indexing" | "ready" | "failed";

/** One curriculum book row as shown in the admin management view. */
export interface CurriculumBook {
  book_id: string;
  book_version: number;
  file_url: string;
  subject: string;
  /** Display label, e.g. "الصف الأول الثانوي" — derived from `stage`. */
  grade: string;
  stage: Stage;
  indexed_at: string;
  status: CurriculumStatus;
  indexing_started_at: string | null;
  /** Set when status === "failed": machine code + the Arabic explanation. */
  error_code: string | null;
  error_message: string | null;
}

// ── Exam generator (خدمات الـ AI → مولّد الامتحانات) ──────────────────────────

export type ExamQuestionType = "mcq" | "truefalse" | "short" | "essay";
export type ExamDifficulty = "easy" | "medium" | "hard" | "mixed";
/** A label only — "امتحان" vs "كويز". Changes nothing about how the paper is built. */
export type ExamKind = "quiz" | "exam";

export interface GenerateExamRequest {
  /** "امتحان" or "كويز" — a label the teacher chooses; same generation either way. */
  kind: ExamKind;
  stage: Stage;
  /** Which uploaded books to draw from; empty = all of this stage's books. */
  bookIds: string[];
  /** Free text: the chapters or topics the paper should cover (also the retrieval query). */
  topics: string;
  questionCount: number;
  questionTypes: ExamQuestionType[];
  difficulty: ExamDifficulty;
  durationMinutes: number;
  totalMarks: number;
  /** The teacher's own questions, one per line, added to the paper verbatim. */
  customQuestions?: string;
  notes?: string;
}

export interface GeneratedExamQuestion {
  prompt: string;
  /** Four choices for mcq, two for true/false, empty for written answers. */
  options: string[];
  marks: number;
}

export interface GeneratedExamSection {
  title: string;
  /** "custom" marks the teacher's own hand-written questions. */
  type: ExamQuestionType | "custom";
  questions: GeneratedExamQuestion[];
}

export interface GeneratedExam {
  /** Mongo id of the saved paper — used to open / delete it from the library. */
  id: string;
  kind: ExamKind;
  /** Kept for the library label; never shown on the printed paper. */
  title: string;
  /** The teacher's name — printed at the bottom-left of the paper. */
  teacherName: string;
  /** The topics the paper covers (echoed back for the library view). */
  topics: string;
  /** Which books the paper was drawn from (echoed back for the library view). */
  bookIds: string[];
  instructions: string[];
  sections: GeneratedExamSection[];
  stage: Stage;
  stageLabel: string;
  subject: string;
  durationMinutes: number;
  /** Recomputed from the questions, so it always matches what is on the page. */
  totalMarks: number;
  questionCount: number;
  /** How many questions came from the teacher's own list (not the curriculum). */
  customQuestionCount: number;
  createdAt: string;
}

export const aiApi = {
  /**
   * Sends a message to the student assistant and resolves with its reply. The
   * backend runs it as a background job, so a slow answer (it can take over a
   * minute) never depends on one request staying open.
   */
  studentChat: (payload: AIChatRequest) =>
    runAsyncJob<AIChatReply>({
      start: () =>
        apiClient.post("/ai/student-chat", payload, { query: { async: 1 } }),
      pollEndpoint: (id) => `/ai/student-chat/jobs/${encodeURIComponent(id)}`,
    }),

  /**
   * Fetches this student's own chat history so the panel can show past
   * messages whenever it's opened, instead of starting blank on every
   * reload. Pass `conversationId` to fetch exactly that thread (e.g. right
   * after starting a new chat, to confirm it's empty); omit it to get
   * whichever thread is this student's most recent one.
   */
  getChatHistory: (conversationId?: string) =>
    apiClient.get<AIChatHistoryResponse>("/ai/student-chat/history", {
      query: { conversation_id: conversationId },
    }),

  /** Permanently wipes every message this student has ever sent/received. */
  clearChatHistory: () =>
    apiClient.delete<{ deletedCount: number }>("/ai/student-chat/history"),

  uploadCurriculum: (payload: UploadCurriculumRequest) => {
    const formData = new FormData();
    formData.append("book_id", payload.book_id);
    if (payload.book_version !== undefined) {
      formData.append("book_version", String(payload.book_version));
    }
    formData.append("stage", payload.stage);
    if (payload.replace) formData.append("replace", "true");
    formData.append("file", payload.file);
    return apiClient.post<{
      book_id: string;
      book_version: number;
      status: CurriculumStatus;
    }>("/ai/upload-curriculum", formData);
  },

  listCurriculum: () =>
    apiClient.get<{ items: CurriculumBook[] }>("/ai/curriculum"),

  /**
   * Stops a book that is still being indexed (an upload by mistake). A new
   * book disappears; a replacement goes back to the version it had.
   */
  cancelCurriculumIndexing: (bookId: string) =>
    apiClient.post<{ book_id: string; outcome: "removed" | "restored" }>(
      `/ai/curriculum/${encodeURIComponent(bookId)}/cancel-indexing`,
    ),

  deleteCurriculum: (bookId: string) =>
    apiClient.delete<{ book_id: string }>(
      `/ai/curriculum/${encodeURIComponent(bookId)}`,
    ),

  /**
   * Generates one exam/quiz paper from the teacher's form and SAVES it. Returns
   * the saved paper (with its id) so the UI can show it and list it in the
   * library. `signal` lets the UI abandon a long generation.
   */
  generateExam: (payload: GenerateExamRequest, signal?: AbortSignal) =>
    runAsyncJob<{ exam: GeneratedExam }>({
      start: () =>
        apiClient.post("/ai/exam-generator", payload, {
          signal,
          query: { async: 1 },
        }),
      pollEndpoint: (id) => `/ai/exam-generator/jobs/${encodeURIComponent(id)}`,
      signal,
    }),

  /** The teacher's saved papers, newest first. */
  listExams: () => apiClient.get<{ items: GeneratedExam[] }>("/ai/exams"),

  /** One saved paper, for viewing / printing. */
  getExam: (id: string) =>
    apiClient.get<{ exam: GeneratedExam }>(
      `/ai/exams/${encodeURIComponent(id)}`,
    ),

  /** Removes one saved paper from the library. */
  deleteExam: (id: string) =>
    apiClient.delete<{ id: string }>(`/ai/exams/${encodeURIComponent(id)}`),
};
