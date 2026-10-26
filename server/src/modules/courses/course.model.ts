import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import { STAGES, type Stage } from "../../config/constants";

/**
 * Represents a course (bundle of lessons) in the platform.
 *
 * A course is the unit students BUY. Lessons live inside a course (Lesson.courseId).
 * A course is scoped to a single academic stage; a student may only purchase a
 * course whose stage matches their own registered stage. The teacher (admin)
 * creates and prices courses from the admin panel, then publishes them.
 */
export interface ICourse {
  title: string;                    // display title shown to students
  slug: string;                     // URL-safe identifier (e.g. "algebra-full-year")
  description: string;              // one-line summary shown in the course card
  longDescription: string;          // full description on the course page ("" → the short one)
  stage: Stage;                     // academic stage: prep3 | sec1 | sec3
  price: number;                    // price in EGP (whole pounds). 0 = free course.
  thumbnail: string | null;         // Cloudinary URL (or legacy /uploads/ path) of the cover image
  thumbnailGradient: string | null; // gradient fallback when no thumbnail image
  isPublished: boolean;             // false = draft, true = visible to students
  order: number;                    // display order within the stage
  createdAt: Date;
  updatedAt: Date;
}

export type CourseDocument = HydratedDocument<ICourse>;

const courseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"],
    },
    description: { type: String, required: true, maxlength: 500 },
    // Empty: the course page shows the short description instead.
    longDescription: { type: String, default: "", maxlength: 5000 },
    stage: {
      type: String,
      required: true,
      enum: Object.values(STAGES),
      index: true,
    },
    price: { type: Number, required: true, min: 0, default: 0 }, // EGP whole pounds
    thumbnail: { type: String, default: null },
    thumbnailGradient: { type: String, default: null },
    isPublished: { type: Boolean, default: false, index: true },
    order: { type: Number, default: 0, index: true },
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

// Compound index for listing published courses for a stage in order.
courseSchema.index({ stage: 1, isPublished: 1, order: 1 });

export const Course: Model<ICourse> =
  mongoose.models.Course || mongoose.model<ICourse>("Course", courseSchema);
