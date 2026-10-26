import { z } from "zod";
import { STAGES } from "../../config/constants";

const slugRegex = /^[a-z0-9-]+$/;

/** Optional: left empty, the server makes one from the title. */
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || slugRegex.test(v), {
    message: "المسار لازم يكون إنجليزي صغير وأرقام وشرطات فقط (مثال: math-full-year)",
  })
  .optional()
  .transform((v) => v || undefined);

const thumbnailSchema = z
  .union([
    z.string().url(),
    z
      .string()
      .regex(/^\/uploads\/thumbnails\/[\w\-.]+$/i, "مسار الصورة غير صالح"),
    z.literal(""),
  ])
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v));

/** Validation schema for creating a new course (admin). */
export const createCourseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, { message: "لازم يكون 3 أحرف على الأقل" })
    .max(200, { message: "أقصى طول ٢٠٠ حرف" }),
  slug: slugSchema,
  description: z
    .string()
    .trim()
    .min(10, { message: "لازم يكون ١٠ أحرف على الأقل" })
    .max(500, { message: "أقصى طول ٥٠٠ حرف" }),
  // Optional: empty means the course page shows the short description.
  longDescription: z
    .string()
    .trim()
    .max(5000, { message: "أقصى طول ٥٠٠٠ حرف" })
    .refine((v) => v === "" || v.length >= 10, {
      message: "لازم يكون ١٠ أحرف على الأقل — أو سيبه فاضي",
    })
    .default(""),
  stage: z.enum(Object.values(STAGES) as [string, ...string[]]),
  price: z.coerce
    .number()
    .min(0, { message: "السعر لا يقل عن صفر" })
    .max(100000, { message: "السعر كبير جدًا" }),
  thumbnail: thumbnailSchema,
  thumbnailGradient: z.string().nullable().optional(),
  order: z.coerce.number().int().default(0),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;

/** All fields optional on update. */
export const updateCourseSchema = createCourseSchema.partial();
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

/** Publish/unpublish toggle. */
export const togglePublishSchema = z.object({
  isPublished: z.boolean(),
});
export type TogglePublishInput = z.infer<typeof togglePublishSchema>;

const courseObjectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "معرّف كورس غير صالح");

/** Actions available when managing several courses from the admin list. */
export const bulkCourseActionSchema = z
  .object({
    action: z.enum(["publish", "unpublish", "delete"]),
    courseIds: z
      .array(courseObjectIdSchema)
      .min(1, "اختار كورس واحد على الأقل")
      .max(200, "لا يمكن تنفيذ الإجراء على أكثر من 200 كورس في المرة الواحدة"),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.courseIds).size !== value.courseIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["courseIds"],
        message: "قائمة الكورسات بها اختيارات مكررة",
      });
    }
  });

export type BulkCourseActionInput = z.infer<typeof bulkCourseActionSchema>;

/** Query parameters for listing courses (admin). */
export const listCoursesQuerySchema = z.object({
  stage: z.enum(Object.values(STAGES) as [string, ...string[]]).optional(),
  search: z.string().trim().optional(),
  isPublished: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
