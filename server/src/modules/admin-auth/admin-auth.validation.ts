import { z } from "zod";

/**
 * Validation schema for the admin login endpoint.
 * Email is lowercased automatically by Zod's .toLowerCase() transform
 * so casing differences (e.g. "Admin@" vs "admin@") are handled transparently.
 */
export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("صيغة الإيميل غير صحيحة"),
  password: z.string().min(1, "كلمة السر مطلوبة"),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/**
 * Validation schema for the admin "change my password" endpoint. Same strength
 * rules as student passwords (8+ chars, at least one letter and one digit).
 */
export const adminChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "كلمة السر الحالية مطلوبة"),
    newPassword: z
      .string()
      .min(8, "كلمة السر لازم 8 حروف على الأقل")
      .max(128, "كلمة السر طويلة جداً")
      .regex(/[A-Za-z]/, "كلمة السر لازم تحتوي على حرف واحد على الأقل")
      .regex(/\d/, "كلمة السر لازم تحتوي على رقم واحد على الأقل"),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "كلمة السر الجديدة لازم تكون مختلفة عن القديمة",
    path: ["newPassword"],
  });

export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;
