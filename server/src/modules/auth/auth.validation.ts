import { z } from "zod";
import { STAGES } from "../../config/constants";

// Shared reusable sub-schemas. Defined once and composed into the main schemas below.

// Egyptian mobile numbers: must start with 010, 011, 012, or 015 and be 11 digits.
const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^01[0-25]\d{8}$/,
    "رقم الهاتف غير صحيح (لازم يكون 11 رقم ويبدأ بـ 010/011/012/015)",
  );

// Password rules: 8-128 chars, at least one letter and one digit.
const passwordSchema = z
  .string()
  .min(8, "كلمة السر لازم 8 حروف على الأقل")
  .max(128, "كلمة السر طويلة جداً")
  .regex(/[A-Za-z]/, "كلمة السر لازم تحتوي على حرف واحد على الأقل")
  .regex(/\d/, "كلمة السر لازم تحتوي على رقم واحد على الأقل");

// Name: 2-50 chars, Arabic or English letters only (no numbers or symbols).
const nameSchema = z
  .string()
  .trim()
  .min(2, "الاسم لازم حرفين على الأقل")
  .max(50, "الاسم طويل جداً")
  .regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, "الاسم لازم حروف عربي أو إنجليزي فقط");

/** Full registration body: three-part name, student phone, parent phone, password, and stage. */
export const registerSchema = z
  .object({
    firstName: nameSchema,
    secondName: nameSchema,
    thirdName: nameSchema,
    studentPhone: phoneSchema,
    parentPhone: phoneSchema,
    password: passwordSchema,
    stage: z.enum(Object.values(STAGES) as [string, ...string[]]),
    studentVerificationCode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "كود الطالب لازم يكون 6 أرقام"),
    parentVerificationCode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "كود ولي الأمر لازم يكون 6 أرقام"),
  })
  .refine((data) => data.studentPhone !== data.parentPhone, {
    path: ["parentPhone"],
    message: "رقم الطالب لازم يكون مختلف عن رقم ولي الأمر",
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/** Sends one verification code to the student and another to the parent. */
export const registrationVerificationRequestSchema = z
  .object({
    studentPhone: phoneSchema,
    parentPhone: phoneSchema,
  })
  .refine((data) => data.studentPhone !== data.parentPhone, {
    path: ["parentPhone"],
    message: "رقم الطالب لازم يكون مختلف عن رقم ولي الأمر",
  });

export type RegistrationVerificationRequestInput = z.infer<
  typeof registrationVerificationRequestSchema
>;

/** Checks a received pair before the registration wizard proceeds. */
export const registrationVerificationCheckSchema = z
  .object({
    studentPhone: phoneSchema,
    parentPhone: phoneSchema,
    studentVerificationCode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "كود الطالب لازم يكون 6 أرقام"),
    parentVerificationCode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "كود ولي الأمر لازم يكون 6 أرقام"),
  })
  .refine((data) => data.studentPhone !== data.parentPhone, {
    path: ["parentPhone"],
    message: "رقم الطالب لازم يكون مختلف عن رقم ولي الأمر",
  });

export type RegistrationVerificationCheckInput = z.infer<
  typeof registrationVerificationCheckSchema
>;

/** Login body: phone + password. Password is not validated strictly here (just non-empty). */
export const loginSchema = z.object({
  studentPhone: phoneSchema,
  password: z.string().min(1, "كلمة السر مطلوبة"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Change-password body.
 * Uses .refine() to cross-validate that the new password differs from the current one.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "كلمة السر الحالية مطلوبة"),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "كلمة السر الجديدة لازم تكون مختلفة عن القديمة",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ── Forgot password (code sent to the student's own WhatsApp) ─────────────────

const resetCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "الكود لازم يكون 6 أرقام");

/** Step 1 — ask for a reset code. */
export const passwordResetRequestSchema = z.object({
  studentPhone: phoneSchema,
});

export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;

/** Step 2 — check the code before showing the new-password form. */
export const passwordResetCheckSchema = z.object({
  studentPhone: phoneSchema,
  code: resetCodeSchema,
});

export type PasswordResetCheckInput = z.infer<typeof passwordResetCheckSchema>;

/** Step 3 — set the new password (the code is checked again and consumed). */
export const passwordResetSchema = z.object({
  studentPhone: phoneSchema,
  code: resetCodeSchema,
  newPassword: passwordSchema,
});

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
