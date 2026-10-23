import mongoose, { Schema, type Model } from "mongoose";

/**
 * A slow AI request that the platform runs in the background.
 *
 * Student-chat answers and exam papers can take well over a minute (every n8n
 * Mongo step costs ~2 s, a summary needs several searches), and a browser
 * request that has to stay open that long is cut by something on the way —
 * a proxy, a phone network, a closed tab. Instead the API answers at once with
 * a job id, keeps talking to n8n for as long as it takes, and the browser asks
 * for the result with short requests. The row below is what links the two.
 */
export const AI_JOB_KINDS = ["student_chat", "exam"] as const;
export type AiJobKind = (typeof AI_JOB_KINDS)[number];
export type AiJobStatus = "running" | "done" | "failed";

export interface AiJobError {
  statusCode: number;
  code?: string;
  message: string;
}

export interface IAiJob {
  kind: AiJobKind;
  /** The student (chat) or admin (exam) who asked: nobody else can read the job. */
  ownerId: string;
  status: AiJobStatus;
  /** Chat: the conversation id, so an answer can be recovered from the history. */
  meta?: { conversationId?: string };
  result?: unknown;
  error?: AiJobError;
  /** Touched by the process that runs the job; a stale value means that process died. */
  heartbeatAt: Date;
  finishedAt?: Date;
  /** Rows are removed by a TTL index after this moment. */
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const aiJobSchema = new Schema<IAiJob>(
  {
    kind: { type: String, enum: AI_JOB_KINDS, required: true },
    ownerId: { type: String, required: true },
    status: {
      type: String,
      enum: ["running", "done", "failed"],
      default: "running",
    },
    meta: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed },
    error: { type: Schema.Types.Mixed },
    heartbeatAt: { type: Date, default: () => new Date() },
    finishedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

aiJobSchema.index({ ownerId: 1, kind: 1, createdAt: -1 });

export const AiJob: Model<IAiJob> =
  mongoose.models.AiJob ||
  mongoose.model<IAiJob>("AiJob", aiJobSchema, "ai_jobs");

/**
 * Production turns Mongoose's autoIndex off, so the TTL index that clears old
 * jobs is created explicitly at startup (idempotent, like the WhatsApp one).
 */
export async function ensureAiJobIndexes(): Promise<void> {
  await AiJob.collection.createIndex(
    { expiresAt: 1 },
    { name: "expiresAt_1", expireAfterSeconds: 0 },
  );
}
