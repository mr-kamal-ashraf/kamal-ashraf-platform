import { z } from "zod";
import { STAGES } from "../../config/constants";

const slugRegex = /^[a-z0-9-]+$/;

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

/**
 * Validation schema for creating a new lesson (admin).
 */
export const createLessonSchema = z.object({
  courseId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "معرف الكورس غير صالح" }),
  title: z
    .string()
    .trim()
    .min(3, { message: "لازم يكون 3 أحرف على الأقل" })
    .max(200, { message: "أقصى طول ٢٠٠ حرف" }),
  slug: z
    .string()
    .trim()
    .regex(slugRegex, {
      message: "المسار لازم يكون إنجليزي صغير وأرقام وشرطات فقط (مثال: lesson-1)",
    }),
  description: z
    .string()
    .trim()
    .min(10, { message: "لازم يكون ١٠ أحرف على الأقل" })
    .max(500, { message: "أقصى طول ٥٠٠ حرف" }),
  longDescription: z
    .string()
    .trim()
    .min(10, { message: "لازم يكون ١٠ أحرف على الأقل — الحقل ده بيظهر في صفحة الدرس" })
    .max(5000, { message: "أقصى طول ٥٠٠٠ حرف" }),
  stage: z.enum(Object.values(STAGES) as [string, ...string[]]).optional(),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(1, { message: "لازم تكون دقيقة واحدة على الأقل" })
    .max(1000, { message: "أقصى ١٠٠٠ دقيقة" }),
  chapters: z.coerce
    .number()
    .int()
    .min(1, { message: "لازم فصل واحد على الأقل" })
    .max(50, { message: "أقصى ٥٠ فصلاً" })
    .default(1),
  topics: z
    .array(
      z
        .string()
        .trim()
        .min(1, { message: "كل محور لازم يكون حرف واحد على الأقل" })
        .max(100, { message: "أقصى طول للمحور ١٠٠ حرف" }),
    )
    .max(20, { message: "أقصى ٢٠ محوراً" })
    .default([]),
  thumbnail: thumbnailSchema,
  thumbnailGradient: z.string().nullable().optional(),
  order: z.coerce.number().int().default(0),
});

export type CreateLessonInput = z.infer<typeof createLessonSchema>;

/**
 * All fields are optional on update so the admin can edit any subset of
 * lesson properties without re-sending the whole object.
 */
export const updateLessonSchema = createLessonSchema.partial();
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

/**
 * Used by the admin publish/unpublish toggle endpoint.
 */
export const togglePublishSchema = z.object({
  isPublished: z.boolean(),
});

export type TogglePublishInput = z.infer<typeof togglePublishSchema>;

const lessonObjectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "معرّف درس غير صالح");

/** Actions available when managing several lessons from the admin list. */
export const bulkLessonActionSchema = z
  .object({
    action: z.enum(["publish", "unpublish", "delete"]),
    lessonIds: z
      .array(lessonObjectIdSchema)
      .min(1, "اختار درس واحد على الأقل")
      .max(200, "لا يمكن تنفيذ الإجراء على أكثر من 200 درس في المرة الواحدة"),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.lessonIds).size !== value.lessonIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lessonIds"],
        message: "قائمة الدروس بها اختيارات مكررة",
      });
    }
  });

export type BulkLessonActionInput = z.infer<typeof bulkLessonActionSchema>;

/**
 * Query parameters for listing lessons (used by both admin and students).
 */
export const listLessonsQuerySchema = z.object({
  courseId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  stage: z.enum(Object.values(STAGES) as [string, ...string[]]).optional(),
  search: z.string().trim().optional(),
  isPublished: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListLessonsQuery = z.infer<typeof listLessonsQuerySchema>;
