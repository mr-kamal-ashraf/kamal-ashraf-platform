import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";

/**
 * Tracks how far a student has watched a specific lesson.
 * One document per (userId, lessonId) pair — upserted on every heartbeat.
 */
export interface ILessonProgress {
  userId: Types.ObjectId;      // the student who watched
  lessonId: Types.ObjectId;    // the lesson being watched
  lastWatchedSecond: number;   // the furthest second reached (for resuming)
  totalSeconds: number;        // total seconds of the lesson
  watchedPercentage: number;   // 0-100 based on lastWatchedSecond / videoDuration
  isCompleted: boolean;        // true when watchedPercentage >= LESSON_COMPLETION_THRESHOLD
  firstWatchedAt: Date;        // when the student first watched the lesson
  lastWatchedAt: Date;         // when the student last watched the lesson
  completedAt: Date | null;    // when the student completed the lesson
  createdAt: Date;
  updatedAt: Date;
}

export type LessonProgressDocument = HydratedDocument<ILessonProgress>;

const progressSchema = new Schema<ILessonProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      index: true,
    },
    lastWatchedSecond: { type: Number, default: 0, min: 0 },
    totalSeconds: { type: Number, default: 0, min: 0 },
    watchedPercentage: { type: Number, default: 0, min: 0, max: 100 },
    isCompleted: { type: Boolean, default: false, index: true },
    firstWatchedAt: { type: Date, default: Date.now },
    lastWatchedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Unique compound index: each student can have at most one progress record per lesson.
progressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
// Index to quickly count/list completed lessons for a user.
progressSchema.index({ userId: 1, lastWatchedAt: -1 });

export const LessonProgress: Model<ILessonProgress> =
  mongoose.models.LessonProgress ||
  mongoose.model<ILessonProgress>("LessonProgress", progressSchema);
