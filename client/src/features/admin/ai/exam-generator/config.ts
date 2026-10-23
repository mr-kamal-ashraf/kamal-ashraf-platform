import type {
  ExamDifficulty,
  ExamKind,
  ExamQuestionType,
  GenerateExamRequest,
} from "@/api";
import type { Stage } from "@/api/types";
import { DEFAULT_STAGE, STAGE_LIST } from "@/shared/lib/stage";

/** Form options and defaults for the exam generator. */

export const KIND_OPTIONS: { value: ExamKind; label: string }[] = [
  { value: "exam", label: "امتحان" },
  { value: "quiz", label: "كويز" },
];

export const QUESTION_TYPE_OPTIONS: { value: ExamQuestionType; label: string }[] = [
  { value: "mcq", label: "اختيار من متعدد" },
  { value: "truefalse", label: "صح وخطأ" },
  { value: "short", label: "أكمل / إجابة قصيرة" },
  { value: "essay", label: "أسئلة مقالية" },
];

export const DIFFICULTY_OPTIONS: { value: ExamDifficulty; label: string }[] = [
  { value: "mixed", label: "متدرج (سهل ومتوسط وصعب)" },
  { value: "easy", label: "سهل" },
  { value: "medium", label: "متوسط" },
  { value: "hard", label: "صعب" },
];

export const STAGE_OPTIONS: { value: Stage; label: string }[] =
  STAGE_LIST.map((s) => ({ value: s.key, label: s.label }));

/** A sensible starting paper: a 30-question mixed exam out of 50 in an hour. */
export const DEFAULT_EXAM_FORM: GenerateExamRequest = {
  kind: "exam",
  stage: DEFAULT_STAGE,
  bookIds: [],
  topics: "",
  questionCount: 30,
  questionTypes: ["mcq"],
  difficulty: "mixed",
  durationMinutes: 60,
  totalMarks: 50,
  customQuestions: "",
  notes: "",
};
