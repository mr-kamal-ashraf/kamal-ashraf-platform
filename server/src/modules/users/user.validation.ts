import { z } from "zod";
import { STAGES } from "../../config/constants";

export const listStudentsQuerySchema = z.object({
  search: z.string().trim().optional(),
  stage: z.enum(Object.values(STAGES) as [string, ...string[]]).optional(),
  status: z.enum(["active", "pending", "suspended", "expired"]).optional(),
  // Monthly commitment band: how much of this month's released lessons the
  // student actually watched (high >= 70%, medium 30-69%, low < 30%).
  commitment: z.enum(["high", "medium", "low"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

export const adminResetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "كلمة السر لازم 8 حروف على الأقل")
    .max(128, "كلمة السر طويلة جداً")
    .regex(/[A-Za-z]/, "كلمة السر لازم تحتوي على حرف واحد على الأقل")
    .regex(/\d/, "كلمة السر لازم تحتوي على رقم واحد على الأقل"),
});

export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

export const grantCourseAccessSchema = z.object({
  // Optional ACTUAL cash amount received. Omitted / blank / null is treated as
  // "not provided" so an empty form field falls back to the course list price
  // rather than silently recording 0.
  amountPaid: z
    .preprocess(
      (v) => (v === undefined || v === null || v === "" ? undefined : v),
      z.coerce.number().min(0).max(1_000_000),
    )
    .optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type GrantCourseAccessInput = z.infer<typeof grantCourseAccessSchema>;

const studentObjectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "معرّف طالب غير صالح");

/** Account-level actions that can safely be applied to several students. */
export const bulkStudentActionSchema = z
  .object({
    action: z.enum(["suspend", "unsuspend", "delete"]),
    studentIds: z
      .array(studentObjectIdSchema)
      .min(1, "اختار طالب واحد على الأقل")
      .max(200, "لا يمكن تنفيذ الإجراء على أكثر من 200 طالب في المرة الواحدة"),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.studentIds).size !== value.studentIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentIds"],
        message: "قائمة الطلاب بها اختيارات مكررة",
      });
    }
  });

export type BulkStudentActionInput = z.infer<typeof bulkStudentActionSchema>;
