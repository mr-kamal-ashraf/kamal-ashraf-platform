import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import { STAGES, type Stage } from "../../config/constants";

/**
 * Metadata record for one curriculum PDF that the AI can retrieve from.
 *
 * The actual chunks (with embeddings) live in the n8n-managed Atlas Vector
 * Search collection `curriculum_chunks`. This local record only tracks WHAT
 * the teacher uploaded — so the admin panel can list, replace, and delete
 * curricula without having to reach into the vector store to enumerate them.
 *
 * teacherId is stored as a string (not ObjectId) because the AI subsystem
 * uses the constant `env.PLATFORM_TEACHER_ID` — a stable slug rather than a
 * DB id — as the multi-tenancy filter. When we go multi-tenant this becomes
 * a Schema.Types.ObjectId ref to Admin, and every read filters by
 * req.user.teacherId. For now the slug is the source of truth.
 */
export const CURRICULUM_STATUSES = ["indexing", "ready", "failed"] as const;
export type CurriculumStatus = (typeof CURRICULUM_STATUSES)[number];

export interface ICurriculum {
  teacherId: string;         // multi-tenancy slug (env.PLATFORM_TEACHER_ID today)
  bookId: string;            // teacher-chosen id, unique per teacher
  bookVersion: number;       // integer, bumped when the teacher re-uploads
  fileUrl: string;           // HTTPS URL that n8n's WF1 downloaded from
  subject: string;           // optional label ("أحياء وجيولوجيا")
  grade: string;             // display label ("الصف الأول الثانوي"), derived from stage
  /**
   * Which academic year this book belongs to — the same enum lessons and
   * students use, NOT the free-text `grade` label.
   *
   * This is what lets the assistant tell a first-year student that what they
   * asked about is second-year material. `grade` is for humans to read; a
   * label typed slightly differently would silently stop matching, so
   * anything the system reasons about goes through `stage`.
   */
  stage: Stage;
  indexedAt: Date;           // when the last successful indexing finished
  /**
   * Indexing runs in the background (a scanned book can take 30+ minutes), so a
   * row exists BEFORE its chunks do. Rows created before this field existed are
   * all finished books, which is why the default is "ready".
   */
  status: CurriculumStatus;
  indexingStartedAt?: Date;  // set while status === "indexing"
  /**
   * Identifies THIS indexing run (it also tags every chunk it writes). WF1 and
   * the OCR service ask "is this run still wanted?" using it, so cancelling
   * only has to make the row stop matching — and a late callback or leftover
   * chunks from a cancelled run can never be confused with a newer upload's.
   */
  ingestionId?: string;
  /** When this run replaces a finished book: what to put back if it is cancelled. */
  previous?: {
    bookVersion: number;
    fileUrl: string;
    subject: string;
    grade: string;
    stage: Stage;
    indexedAt: Date;
    status: CurriculumStatus;
    errorCode?: string;
    errorMessage?: string;
  };
  errorCode?: string;        // set when status === "failed" (see curriculum-upload-errors.ts)
  errorMessage?: string;     // the Arabic explanation shown to the admin
  createdAt: Date;
  updatedAt: Date;
}

/**
 * An "indexing" row that never got its result callback (n8n or the OCR service
 * died mid-run) must not look busy forever — past this age it is shown as
 * failed and can be replaced or deleted again.
 */
export const INDEXING_STALE_MS = 3 * 60 * 60 * 1000;

export function isIndexingStalled(row: {
  status?: CurriculumStatus;
  indexingStartedAt?: Date;
  updatedAt?: Date;
}): boolean {
  if (row.status !== "indexing") return false;
  const since = row.indexingStartedAt ?? row.updatedAt;
  return !since || Date.now() - new Date(since).getTime() > INDEXING_STALE_MS;
}

export type CurriculumDocument = HydratedDocument<ICurriculum>;

const curriculumSchema = new Schema<ICurriculum>(
  {
    teacherId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      index: true,
    },
    bookId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      match: [
        /^[a-zA-Z0-9_-]{1,64}$/,
        "book_id must be 1-64 chars of [a-zA-Z0-9_-]",
      ],
    },
    bookVersion: { type: Number, required: true, min: 1, default: 1 },
    fileUrl: { type: String, required: true, trim: true, maxlength: 2000 },
    subject: { type: String, default: "", trim: true, maxlength: 120 },
    grade: { type: String, default: "", trim: true, maxlength: 60 },
    stage: {
      type: String,
      required: true,
      enum: Object.values(STAGES),
      index: true,
    },
    indexedAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: CURRICULUM_STATUSES,
      default: "ready",
    },
    indexingStartedAt: { type: Date },
    ingestionId: { type: String, trim: true, maxlength: 80 },
    previous: { type: Schema.Types.Mixed },
    errorCode: { type: String, trim: true, maxlength: 60 },
    errorMessage: { type: String, trim: true, maxlength: 600 },
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

// Each teacher can have at most ONE curriculum with a given book_id (versions
// are tracked on the row itself; re-uploading with the same book_id upserts).
curriculumSchema.index({ teacherId: 1, bookId: 1 }, { unique: true });

export const Curriculum: Model<ICurriculum> =
  mongoose.models.Curriculum ||
  mongoose.model<ICurriculum>("Curriculum", curriculumSchema);
