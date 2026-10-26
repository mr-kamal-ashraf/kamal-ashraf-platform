import { z } from "zod";
import { STAGES } from "../../config/constants";

const slugRegex = /^[a-z0-9-]+$/;

/** Optional: left empty, the server makes one from the title. */
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || slugRegex.test(v), {
    message: "المسار لازم يكون إنجليزي صغير وأرقام وشرطات فقط (مثال: lesson-1)",
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
  slug: slugSchema,
  description: z
    .string()
    .trim()
    .min(10, { message: "لازم يكون ١٠ أحرف على الأقل" })
    .max(500, { message: "أقصى طول ٥٠٠ حرف" }),
  // Optional: empty means the lesson page shows the short description.
  longDescription: z
    .string()
    .trim()
    .max(5000, { message: "أقصى طول ٥٠٠٠ حرف" })
    .refine((v) => v === "" || v.length >= 10, {
      message: "لازم يكون ١٠ أحرف على الأقل — أو سيبه فاضي",
    })
    .default(""),
  stage: z.enum(Object.values(STAGES) as [string, ...string[]]).optional(),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(1, { message: "لازم تكون دقيقة واحدة على الأقل" })
    .max(1000, { message: "أقصى ١٠٠٠ دقيقة" })
    .optional(),
  // The duration follows the uploaded video's real length (default when no
  // duration is given).
  durationAuto: z.boolean().optional(),
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
  // Left out: the lesson goes after the course's last one.
  order: z.coerce.number().int().optional(),
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
  // Publishing while the video is still being prepared: publish it by itself
  // the moment it's ready, instead of refusing.
  whenReady: z.boolean().optional(),
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

/** A course's lessons in their new order — all of them, each once. */
export const reorderLessonsSchema = z
  .object({
    courseId: z.string().regex(/^[0-9a-fA-F]{24}$/, "معرف الكورس غير صالح"),
    lessonIds: z.array(lessonObjectIdSchema).min(1).max(500),
  })
  .refine((v) => new Set(v.lessonIds).size === v.lessonIds.length, {
    path: ["lessonIds"],
    message: "قائمة الدروس بها اختيارات مكررة",
  });

export type ReorderLessonsInput = z.infer<typeof reorderLessonsSchema>;

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
