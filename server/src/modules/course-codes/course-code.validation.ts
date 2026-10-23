import { z } from "zod";
import { COURSE_CODE_STATUS } from "../../config/constants";

const objectId = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "معرّف غير صحيح");

/** POST /admin/course-codes — generate a batch for one course. */
export const generateCodesSchema = z.object({
  courseId: objectId,
  count: z.coerce
    .number()
    .int("العدد لازم يكون رقم صحيح")
    .min(1, "العدد لازم يكون 1 على الأقل")
    .max(500, "أقصى عدد في المرة الواحدة 500 كود"),
  /** What each code sells for; omitted → the course's current price. */
  price: z.coerce.number().min(0, "السعر مينفعش يكون بالسالب").max(100_000).optional(),
  label: z.string().trim().max(80, "الوصف طويل جداً (أقصى حد 80 حرف)").optional(),
});

export type GenerateCodesInput = z.infer<typeof generateCodesSchema>;

/** GET /admin/course-codes — one course's codes. */
export const listCodesQuerySchema = z.object({
  courseId: objectId,
  status: z
    .enum(Object.values(COURSE_CODE_STATUS) as [string, ...string[]])
    .optional(),
  batchId: z.string().trim().max(40).optional(),
  /** Part of a code, or the redeeming student's name / phone. */
  search: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListCodesQuery = z.infer<typeof listCodesQuerySchema>;

/** GET /admin/course-codes/export — same filters, no paging. */
export const exportCodesQuerySchema = listCodesQuerySchema.omit({
  page: true,
  limit: true,
  search: true,
});

export type ExportCodesQuery = z.infer<typeof exportCodesQuerySchema>;

/** PATCH /admin/course-codes/:id — switch an unused code off or back on. */
export const setCodeDisabledSchema = z.object({
  disabled: z.boolean(),
});

/** POST /admin/course-codes/bulk-delete — remove codes for good. */
export const deleteCodesSchema = z
  .object({
    codeIds: z
      .array(objectId)
      .min(1, "اختار كود واحد على الأقل")
      .max(500, "أقصى عدد في المرة الواحدة 500 كود"),
  })
  .refine((v) => new Set(v.codeIds).size === v.codeIds.length, {
    message: "فيه كود متكرر في الاختيار",
    path: ["codeIds"],
  });

export type DeleteCodesInput = z.infer<typeof deleteCodesSchema>;

/** POST /course-codes/redeem — a student types a code. */
export const redeemCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, "اكتب الكود")
    .max(40, "الكود طويل جداً"),
  /** The course page it was typed on — the code must be for that course. */
  courseId: objectId.optional(),
});

export type RedeemCodeInput = z.infer<typeof redeemCodeSchema>;
