import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import { STAGES, VIDEO_STATUS, type Stage, type VideoStatus } from "../../config/constants";

/**
 * Represents a lesson (video lecture) in the platform.
 * Lessons are scoped to a specific academic stage and can be in draft or published state.
 * The video is hosted on Bunny Stream; the thumbnail image is hosted on Cloudinary
 * (or legacy local path /uploads/).
 */
export interface ILesson {
  courseId: Types.ObjectId;          // the course this lesson belongs to
  title: string;                    // display title shown to students
  slug: string;                     // URL-safe identifier (e.g. "algebra-chapter-1")
  description: string;              // one-line summary shown in the lesson list
  longDescription: string;          // full description shown on the lesson detail page
  stage: Stage;                     // academic stage: prep3 | sec1 | sec3
  durationMinutes: number;          // approximate duration displayed in the UI
  chapters: number;                 // number of chapters in the lesson
  topics: string[];                 // topic tags for filtering
  bunnyVideoId: string | null;      // Bunny Stream video ID (null before upload)
  videoDurationSeconds: number;     // exact duration used to calculate watch percentage
  videoStatus: VideoStatus | null;  // Bunny conversion state (null: no video, or not checked yet)
  videoCheckedAt: Date | null;      // last time Bunny was asked — spaces out the checks
  thumbnail: string | null;      // URL or local path of the thumbnail image
  thumbnailGradient: string | null; // gradient color for the thumbnail
  isPublished: boolean;             // false = draft, true = visible to students
  publishedAt: Date | null;         // when the lesson was FIRST published (set once, used to compute "days since release")
  order: number;                    // display order within the stage
  createdAt: Date;
  updatedAt: Date;
}

export type LessonDocument = HydratedDocument<ILesson>;

const lessonSchema = new Schema<ILesson>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    }, // the course this lesson belongs to
    title: { type: String, required: true, trim: true, maxlength: 200 }, // display title shown to students
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"],
    }, // URL-safe identifier (e.g. "algebra-chapter-1")
    description: { type: String, required: true, maxlength: 500 }, // one-line summary shown in the lesson list
    longDescription: { type: String, required: true, maxlength: 5000 }, // full description shown on the lesson detail page
    stage: {
      type: String,
      required: true,
      enum: Object.values(STAGES),
      index: true,
    }, // academic stage: prep3 | sec1 | sec3
    durationMinutes: { type: Number, required: true, min: 1 }, // approximate duration displayed in the UI
    chapters: { type: Number, required: true, min: 1, default: 1 }, // number of chapters in the lesson
    topics: { type: [String], default: [] }, // topic tags for filtering
    bunnyVideoId: { type: String, default: null, index: true }, // Bunny Stream video ID (null before upload)
    videoDurationSeconds: { type: Number, default: 0, min: 0 }, // exact duration used to calculate watch percentage
    videoStatus: { type: String, enum: [...Object.values(VIDEO_STATUS), null], default: null }, // Bunny conversion state (null: no video, or not checked yet)
    videoCheckedAt: { type: Date, default: null }, // last time Bunny was asked — spaces out the checks
    thumbnail: { type: String, default: null }, // URL or local path of the thumbnail image
    thumbnailGradient: { type: String, default: null }, // gradient color for the thumbnail
    isPublished: { type: Boolean, default: false, index: true }, // false = draft, true = visible to students
    publishedAt: { type: Date, default: null, index: true }, // set once on first publish; used to compute "days since release"
    order: { type: Number, default: 0, index: true }, // display order within the stage
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

// Compound index for listing published lessons for a stage in order.
lessonSchema.index({ stage: 1, isPublished: 1, order: 1 });
// Compound index for listing a course's lessons in order.
lessonSchema.index({ courseId: 1, order: 1 });
export const Lesson: Model<ILesson> =
  mongoose.models.Lesson || mongoose.model<ILesson>("Lesson", lessonSchema);
