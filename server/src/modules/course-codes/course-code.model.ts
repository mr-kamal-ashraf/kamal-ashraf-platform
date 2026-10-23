import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";
import {
  COURSE_CODE_STATUS,
  type CourseCodeStatus,
} from "../../config/constants";

/**
 * A prepaid, single-use code that opens one course — the teacher prints a
 * batch and sells them offline (in the centre, at a bookshop); the student
 * types the code on the course page and the course opens instantly.
 *
 * Codes are generated together as a "batch" (one generate action) so the
 * teacher can export, print or track a run as a unit. `price` is what each
 * code sells for; it becomes the enrollment's amountPaid on redemption, so the
 * sales report counts code revenue correctly.
 */
export interface ICourseCode {
  code: string; // "ABCD-EFGH-JKMN" (unique, upper-case, no look-alike chars)
  courseId: Types.ObjectId;
  batchId: string;
  batchLabel: string | null; // the teacher's note for the batch, e.g. where it's sold
  price: number; // EGP each code is sold for
  status: CourseCodeStatus;
  usedBy: Types.ObjectId | null;
  usedAt: Date | null;
  createdBy: Types.ObjectId; // admin who generated the batch
  createdAt: Date;
  updatedAt: Date;
}

export type CourseCodeDocument = HydratedDocument<ICourseCode>;

const courseCodeSchema = new Schema<ICourseCode>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    batchId: { type: String, required: true, index: true },
    batchLabel: { type: String, default: null, maxlength: 80 },
    price: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(COURSE_CODE_STATUS),
      default: COURSE_CODE_STATUS.AVAILABLE,
      index: true,
    },
    usedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    usedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
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

// The admin list: a course's codes by status, newest first.
courseCodeSchema.index({ courseId: 1, status: 1, createdAt: -1 });

export const CourseCode: Model<ICourseCode> =
  mongoose.models.CourseCode ||
  mongoose.model<ICourseCode>("CourseCode", courseCodeSchema);
