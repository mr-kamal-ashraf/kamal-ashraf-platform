import { env } from "../../config/env";
import { ApiError } from "../../shared/utils/ApiError";
import { logger } from "../../shared/utils/logger";
import { STAGE_LABELS } from "../../config/constants";
import { Admin } from "../admins/admin.model";
import * as aiService from "./ai.service";
import {
  GeneratedExamModel,
  type GeneratedExamDocument,
  type ExamSectionType,
} from "./generatedExam.model";
import type { GenerateExamInput } from "./ai.validation";

/**
 * Exam generator — a form-driven tool (deliberately NOT a chat).
 *
 * The teacher fills a form and gets back a finished paper, ready to print. The
 * questions are generated ENTIRELY from the teacher's own uploaded curriculum:
 * this service calls the n8n exam workflow (WF14), which retrieves the relevant
 * curriculum chunks — now across one OR several chosen books — and has the
 * model write questions from that content alone, never from general knowledge.
 *
 * The teacher's own hand-written questions are handled HERE, not by the model:
 * they are appended to the paper verbatim, because they may be questions that
 * are intentionally outside the uploaded curriculum.
 *
 * Every generated paper is PERSISTED (see generatedExam.model) so the teacher
 * keeps a library they can re-open, print, or delete. The platform never keeps
 * an answer key — papers are questions-only by design.
 */

export type UiQuestionType = "mcq" | "truefalse" | "short" | "essay";

/** Arabic labels for the question types the form offers. */
export const QUESTION_TYPE_LABELS_AR: Record<UiQuestionType, string> = {
  mcq: "اختيار من متعدد",
  truefalse: "صح وخطأ",
  short: "أكمل / إجابة قصيرة",
  essay: "أسئلة مقالية",
};

/** Section heading per question type. */
const SECTION_TITLES_AR: Record<UiQuestionType, string> = {
  mcq: "أولاً: اختر الإجابة الصحيحة",
  truefalse: "ثانياً: ضع علامة (√) أو (×)",
  short: "ثالثاً: أجب عن الأسئلة الآتية",
  essay: "رابعاً: أجب بالتفصيل",
};

export interface ExamQuestion {
  prompt: string;
  options: string[];
  marks: number;
}

export interface ExamSection {
  title: string;
  type: ExamSectionType;
  questions: ExamQuestion[];
}

/** The shape returned to the frontend — matches one saved GeneratedExam row. */
export interface SerializedExam {
  id: string;
  kind: "quiz" | "exam";
  title: string;
  stage: string;
  stageLabel: string;
  subject: string;
  topics: string;
  bookIds: string[];
  teacherName: string;
  instructions: string[];
  sections: ExamSection[];
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  customQuestionCount: number;
  createdAt: string;
}

/**
 * Normalizes whatever question-type string the workflow returns onto the four
 * the UI knows, defaulting anything unexpected to a written short-answer so a
 * stray type never drops a question off the paper.
 */
function normalizeType(raw: string | undefined): UiQuestionType {
  switch ((raw ?? "").toLowerCase()) {
    case "mcq":
    case "multiple_choice":
      return "mcq";
    case "true_false":
    case "truefalse":
      return "truefalse";
    case "essay":
      return "essay";
    default:
      return "short";
  }
}

const TRUE_FALSE_ANSWERS = new Set(["صح", "خطأ", "خطا", "true", "false"]);

/**
 * The type of a question the model sent WITHOUT one (it sometimes drops the
 * field once every question has the same type). With a single requested type
 * that is the answer; otherwise it is read off the question itself — a
 * question that lost its choices must not be treated as a written one.
 */
function inferType(
  q: aiService.ExamGenQuestion,
  requested: readonly UiQuestionType[],
): UiQuestionType {
  if (requested.length === 1) return requested[0];
  const options = (q.options ?? []).filter((o) => o.trim());
  if (options.length >= 3) return "mcq";
  const answer = (q.correct_answer ?? "").trim().toLowerCase();
  if (options.length <= 2 && TRUE_FALSE_ANSWERS.has(answer)) return "truefalse";
  if (options.length === 2) return "mcq";
  return !requested.includes("short") && requested.includes("essay")
    ? "essay"
    : "short";
}

/** true/false options are fixed; MCQ keeps whatever options came back. */
function optionsFor(type: UiQuestionType, options: string[] | undefined): string[] {
  if (type === "truefalse") return ["صح", "خطأ"];
  if (type === "mcq") return options ?? [];
  return [];
}

/**
 * Spreads the total marks across every question as evenly as whole numbers
 * allow, giving the remainder to the first questions. Runs over the combined
 * generated + custom set so the paper always sums to exactly the total.
 */
function distributeMarks(count: number, totalMarks: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalMarks / count);
  let remainder = totalMarks - base * count;
  return Array.from({ length: count }, () => {
    const mark = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return mark;
  });
}

/** Splits the teacher's free-text block into one question per non-empty line. */
function parseCustomQuestions(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * WF14 historically used `no_content: true` for both a failed retrieval and
 * an exhausted platform AI balance. The latter must not blame the curriculum.
 */
function isOutOfCreditResponse(result: {
  error_code?: string;
  message?: string;
}): boolean {
  const errorCode = (result.error_code ?? "").trim().toUpperCase();
  if (
    errorCode === "OUT_OF_CREDIT" ||
    errorCode === "AI_OUT_OF_CREDIT" ||
    errorCode === "CREDITS_EXHAUSTED"
  ) {
    return true;
  }

  // Backward compatibility with the published workflow response, which did
  // not always include an error code on this branch.
  return /رصيد|متوقفة\s+مؤقت/.test((result.message ?? "").trim());
}

/** Maps a persisted row to the API shape the frontend consumes. */
export function serializeExam(doc: GeneratedExamDocument): SerializedExam {
  return {
    id: String(doc._id),
    kind: doc.kind,
    title: doc.title,
    stage: doc.stage,
    stageLabel: doc.stageLabel,
    subject: doc.subject,
    topics: doc.topics,
    bookIds: doc.bookIds ?? [],
    teacherName: doc.teacherName,
    instructions: doc.instructions ?? [],
    sections: (doc.sections ?? []).map((section) => ({
      title: section.title,
      type: section.type,
      questions: (section.questions ?? []).map((q) => ({
        prompt: q.prompt,
        options: q.options ?? [],
        marks: q.marks,
      })),
    })),
    durationMinutes: doc.durationMinutes,
    totalMarks: doc.totalMarks,
    questionCount: doc.questionCount,
    customQuestionCount: doc.customQuestionCount,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** The platform's single teacher name, for the paper's footer. "" if unknown. */
async function resolveTeacherName(): Promise<string> {
  const admin = await Admin.findOne().select("name").sort({ createdAt: 1 }).lean();
  return admin?.name ?? "";
}

/**
 * Generates one exam/quiz paper from the teacher's form input, PERSISTS it, and
 * returns the saved row.
 *
 * Throws a clean ApiError on every failure path so the route never leaks the
 * upstream response verbatim. A "no curriculum content" result is surfaced as
 * a clear, actionable message rather than a fabricated exam.
 */
export async function generateExam(
  input: GenerateExamInput,
  n8nOptions?: aiService.N8nCallOptions,
): Promise<SerializedExam> {
  const teacherId = env.PLATFORM_TEACHER_ID;
  const customPrompts = parseCustomQuestions(input.customQuestions);

  const result = await aiService.callExamGenerator(
    {
      teacher_id: teacherId,
      stage: input.stage,
      topic: input.topics,
      question_count: input.questionCount,
      difficulty: input.difficulty,
      question_types: input.questionTypes.join(","),
      book_ids: input.bookIds,
    },
    n8nOptions,
  );

  if (result.ok !== true) {
    logger.error("[exam.service] workflow returned not-ok", {
      error_code: result.error_code,
    });
    if (isOutOfCreditResponse(result)) {
      throw new ApiError(
        402,
        "رصيد الذكاء الاصطناعي للمنصة خلص. تواصل مع إدارة المنصة لشحن الرصيد.",
        { code: "AI_OUT_OF_CREDIT" },
      );
    }
    if (result.error_code === "RATE_LIMIT_EXCEEDED") {
      throw new ApiError(429, "وصلت للحد الأقصى لتوليد الامتحانات دلوقتي، جرّب تاني بعدين.", {
        code: "EXAM_RATE_LIMIT",
      });
    }
    throw new ApiError(502, "مقدرناش نولّد الامتحان دلوقتي، جرّب تاني بعد شوية.", {
      code: "EXAM_GENERATION_FAILED",
    });
  }

  // Grounded generation found nothing to build from. Only a hard failure when
  // the teacher didn't supply their own questions either — otherwise fall
  // through and build a paper from the custom questions alone.
  const rawQuestions = result.exam?.questions ?? [];
  if (result.no_content === true && isOutOfCreditResponse(result)) {
    throw new ApiError(
      402,
      "رصيد الذكاء الاصطناعي للمنصة خلص. تواصل مع إدارة المنصة لشحن الرصيد.",
      { code: "AI_OUT_OF_CREDIT" },
    );
  }
  if (result.no_content === true && rawQuestions.length === 0 && customPrompts.length === 0) {
    throw new ApiError(422, "مفيش محتوى في المنهج المرفوع يغطّي الموضوعات دي. اختر كتاب تاني أو ارفع المنهج المناسب الأول.", {
      code: "EXAM_NO_CURRICULUM_CONTENT",
    });
  }

  // ── Group the AI-generated questions by type into ordered sections ──────────
  // Answers are deliberately dropped here and never stored: the platform does
  // not keep an answer key.
  const buckets = new Map<UiQuestionType, ExamQuestion[]>();
  for (const q of rawQuestions) {
    const type = q.question_type?.trim()
      ? normalizeType(q.question_type)
      : inferType(q, input.questionTypes);
    const question: ExamQuestion = {
      prompt: (q.question_text ?? "").trim(),
      options: optionsFor(type, q.options),
      marks: 0, // assigned after we know the full count
    };
    if (!question.prompt) continue;
    const bucket = buckets.get(type);
    if (bucket) bucket.push(question);
    else buckets.set(type, [question]);
  }

  const orderedTypes: UiQuestionType[] = ["mcq", "truefalse", "short", "essay"];
  const sections: ExamSection[] = orderedTypes
    .filter((type) => buckets.get(type)?.length)
    .map((type) => ({
      title: SECTION_TITLES_AR[type],
      type,
      questions: buckets.get(type) as ExamQuestion[],
    }));

  // ── Append the teacher's own questions verbatim, as their own section ───────
  if (customPrompts.length > 0) {
    sections.push({
      title: "أسئلة إضافية من المدرس",
      type: "custom",
      questions: customPrompts.map((prompt) => ({
        prompt,
        options: [],
        marks: 0,
      })),
    });
  }

  const allQuestions = sections.flatMap((section) => section.questions);
  if (allQuestions.length === 0) {
    throw new ApiError(502, "الامتحان رجع فاضي، جرّب تولّده تاني.", {
      code: "EXAM_GENERATION_EMPTY",
    });
  }

  // Distribute the total marks across every question so the paper sums exactly.
  const marks = distributeMarks(allQuestions.length, input.totalMarks);
  allQuestions.forEach((question, index) => {
    question.marks = marks[index] ?? 1;
  });

  const rawInstructions = result.exam?.instructions;
  const instructions = Array.isArray(rawInstructions)
    ? rawInstructions
    : rawInstructions
      ? [rawInstructions]
      : [];

  const kindLabel = input.kind === "quiz" ? "كويز" : "امتحان";
  const stageLabel = STAGE_LABELS[input.stage] ?? input.stage;
  const title =
    result.exam?.exam_title?.trim() ||
    `${kindLabel} ${env.PLATFORM_SUBJECT} — ${stageLabel}`.trim();

  const teacherName = await resolveTeacherName();

  // ── Persist the paper so it survives a refresh and joins the library ────────
  const doc = await GeneratedExamModel.create({
    teacherId,
    kind: input.kind,
    title,
    stage: input.stage,
    stageLabel,
    subject: env.PLATFORM_SUBJECT,
    topics: input.topics,
    bookIds: input.bookIds,
    teacherName,
    instructions,
    sections,
    durationMinutes: input.durationMinutes,
    totalMarks: input.totalMarks,
    questionCount: allQuestions.length,
    customQuestionCount: customPrompts.length,
  });

  return serializeExam(doc);
}

/** The teacher's saved papers, newest first. */
export async function listExams(): Promise<SerializedExam[]> {
  const docs = await GeneratedExamModel.find({
    teacherId: env.PLATFORM_TEACHER_ID,
  })
    .sort({ createdAt: -1 })
    .limit(200);
  return docs.map((doc) => serializeExam(doc));
}

/** One saved paper by id, scoped to this teacher. Throws 404 if not found. */
export async function getExam(id: string): Promise<SerializedExam> {
  const doc = await GeneratedExamModel.findOne({
    _id: id,
    teacherId: env.PLATFORM_TEACHER_ID,
  });
  if (!doc) {
    throw ApiError.notFound("الامتحان غير موجود", "EXAM_NOT_FOUND");
  }
  return serializeExam(doc);
}

/** Deletes one saved paper, scoped to this teacher. Throws 404 if not found. */
export async function deleteExam(id: string): Promise<void> {
  const res = await GeneratedExamModel.deleteOne({
    _id: id,
    teacherId: env.PLATFORM_TEACHER_ID,
  });
  if (res.deletedCount === 0) {
    throw ApiError.notFound("الامتحان غير موجود", "EXAM_NOT_FOUND");
  }
}
