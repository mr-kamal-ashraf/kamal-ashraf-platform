import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import { STAGES, type Stage } from "../../config/constants";

/**
 * A saved exam/quiz paper the teacher generated from the exam generator.
 *
 * The exam generator used to be a one-shot tool that kept nothing — the
 * teacher printed the result and it was gone on refresh. Teachers asked to
 * keep a library of what they made, so every generated paper is now persisted
 * here and listed in the panel (view / open / print / delete).
 *
 * Answers are NEVER stored: the paper is for printing and handing out, and the
 * platform deliberately does not keep an answer key. Only the questions, their
 * options (for mcq / true-false) and their marks are persisted.
 *
 * `kind` is purely a label ("امتحان" vs "كويز") — it changes nothing about how
 * the paper is built, it is only how the teacher wants to call it.
 *
 * teacherId is the same multi-tenancy slug used across the AI subsystem
 * (env.PLATFORM_TEACHER_ID today).
 */

export type ExamKind = "quiz" | "exam";
export type ExamSectionType = "mcq" | "truefalse" | "short" | "essay" | "custom";

export interface IGeneratedExamQuestion {
  prompt: string;
  options: string[];
  marks: number;
}

export interface IGeneratedExamSection {
  title: string;
  type: ExamSectionType;
  questions: IGeneratedExamQuestion[];
}

export interface IGeneratedExam {
  teacherId: string;
  kind: ExamKind;
  title: string;
  stage: Stage;
  stageLabel: string;
  subject: string;
  topics: string;
  bookIds: string[];
  teacherName: string;
  instructions: string[];
  sections: IGeneratedExamSection[];
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  customQuestionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type GeneratedExamDocument = HydratedDocument<IGeneratedExam>;

const questionSchema = new Schema<IGeneratedExamQuestion>(
  {
    prompt: { type: String, required: true },
    options: { type: [String], default: [] },
    marks: { type: Number, required: true, default: 1 },
  },
  { _id: false },
);

const sectionSchema = new Schema<IGeneratedExamSection>(
  {
    title: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["mcq", "truefalse", "short", "essay", "custom"],
    },
    questions: { type: [questionSchema], default: [] },
  },
  { _id: false },
);

const generatedExamSchema = new Schema<IGeneratedExam>(
  {
    teacherId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      index: true,
    },
    kind: { type: String, required: true, enum: ["quiz", "exam"], default: "exam" },
    title: { type: String, default: "", trim: true, maxlength: 200 },
    stage: {
      type: String,
      required: true,
      enum: Object.values(STAGES),
    },
    stageLabel: { type: String, default: "", trim: true, maxlength: 60 },
    subject: { type: String, default: "", trim: true, maxlength: 120 },
    topics: { type: String, default: "", trim: true, maxlength: 500 },
    bookIds: { type: [String], default: [] },
    teacherName: { type: String, default: "", trim: true, maxlength: 100 },
    instructions: { type: [String], default: [] },
    sections: { type: [sectionSchema], default: [] },
    durationMinutes: { type: Number, required: true, default: 60 },
    totalMarks: { type: Number, required: true, default: 50 },
    questionCount: { type: Number, required: true, default: 0 },
    customQuestionCount: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Newest first for the teacher's library view.
generatedExamSchema.index({ teacherId: 1, createdAt: -1 });

export const GeneratedExamModel: Model<IGeneratedExam> =
  mongoose.models.GeneratedExam ||
  mongoose.model<IGeneratedExam>("GeneratedExam", generatedExamSchema);
