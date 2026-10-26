// Standard HTTP status codes used across controllers and error helpers.
// Centralised here so we never hard-code magic numbers like 404 or 500.
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Names of the HttpOnly cookies used to carry JWT access and refresh tokens.
// Students and admins get separate cookie pairs to avoid collisions.
export const COOKIE_NAMES = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
  ADMIN_ACCESS_TOKEN: "admin_access_token",
  ADMIN_REFRESH_TOKEN: "admin_refresh_token",
} as const;

// The two possible user roles in the system.
// Used in JWT payloads, session records, and auth middleware guards.
export const ROLES = {
  STUDENT: "student",
  ADMIN: "admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Academic stage (grade) a student belongs to.
// Lessons are filtered per stage so students only see their own content.
// This platform teaches exactly three years: 3rd preparatory, 1st secondary
// and 3rd secondary (there is no 2nd secondary on purpose).
export const STAGES = {
  PREP3: "prep3",
  SEC1: "sec1",
  SEC3: "sec3",
} as const;

export type Stage = (typeof STAGES)[keyof typeof STAGES];

/** The stage values as a typed tuple, for z.enum(). */
export const STAGE_VALUES = [STAGES.PREP3, STAGES.SEC1, STAGES.SEC3] as const;

/**
 * Human-readable Arabic label per stage. Derived from the enum rather than
 * typed by hand anywhere, so a label can never drift out of sync with the
 * value the system actually matches on.
 */
export const STAGE_LABELS: Record<Stage, string> = {
  prep3: "الصف الثالث الإعدادي",
  sec1: "الصف الأول الثانوي",
  sec3: "الصف الثالث الثانوي",
};

/**
 * The next stage this platform teaches after the given one. Used to tell a
 * student that what they asked about is material they will take later. null
 * for the final year — there is no "next year" to point at.
 */
export const NEXT_STAGE: Record<Stage, Stage | null> = {
  prep3: "sec1",
  sec1: "sec3",
  sec3: null,
};

// Machine-readable codes sent to the frontend when access to a resource is denied.
// The client uses these codes to decide which UI message or redirect to show.
export const ACCESS_DENIAL_REASONS = {
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  ACCOUNT_NOT_ACTIVATED: "ACCOUNT_NOT_ACTIVATED",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  NO_SUBSCRIPTION: "NO_SUBSCRIPTION",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  STAGE_MISMATCH: "STAGE_MISMATCH",
  LESSON_NOT_PUBLISHED: "LESSON_NOT_PUBLISHED",
  LESSON_NOT_FOUND: "LESSON_NOT_FOUND",
  NOT_ENROLLED: "NOT_ENROLLED",
  COURSE_NOT_PUBLISHED: "COURSE_NOT_PUBLISHED",
  COURSE_NOT_FOUND: "COURSE_NOT_FOUND",
} as const;

// Where a lesson's video is on Bunny Stream. Bunny keeps converting a video
// for a while after the upload finishes; it can't be played (or published)
// until it's ready.
export const VIDEO_STATUS = {
  PROCESSING: "processing", // uploaded, Bunny is still converting it
  READY: "ready",           // playable
  FAILED: "failed",         // Bunny couldn't convert it — upload it again
} as const;

export type VideoStatus = (typeof VIDEO_STATUS)[keyof typeof VIDEO_STATUS];


// ── Courses / enrollments / payments (new course-purchase system) ───────────

// How a student came to own a course.
export const ENROLLMENT_SOURCE = {
  PAYMOB: "paymob", // paid online through the Paymob gateway
  CASH: "cash",     // opened manually by the admin after cash-in-hand
  CODE: "code",     // student redeemed a prepaid course code (sold offline)
} as const;

export type EnrollmentSource =
  (typeof ENROLLMENT_SOURCE)[keyof typeof ENROLLMENT_SOURCE];

// State of a prepaid course code.
export const COURSE_CODE_STATUS = {
  AVAILABLE: "available", // not redeemed yet
  USED: "used",           // redeemed by a student (one use only)
  DISABLED: "disabled",   // switched off by the admin (lost / not sold)
} as const;

export type CourseCodeStatus =
  (typeof COURSE_CODE_STATUS)[keyof typeof COURSE_CODE_STATUS];

// State of a course-ownership record.
export const ENROLLMENT_STATUS = {
  ACTIVE: "active",   // student currently has access
  REVOKED: "revoked", // admin removed access
} as const;

export type EnrollmentStatus =
  (typeof ENROLLMENT_STATUS)[keyof typeof ENROLLMENT_STATUS];

// State of an online payment attempt.
export const PAYMENT_STATUS = {
  PENDING: "pending", // checkout started, awaiting Paymob confirmation
  PAID: "paid",       // confirmed by the HMAC-verified webhook
  FAILED: "failed",   // declined / cancelled
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// How an online payment is made (all through Paymob).
export const PAYMENT_METHOD = {
  CARD: "card",     // Visa / Mastercard / Meeza in Paymob's iframe
  WALLET: "wallet", // Vodafone Cash & other mobile wallets
  KIOSK: "kiosk",   // cash at an Aman / Masary outlet, with a reference number
} as const;

export type PaymentMethod =
  (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

// Why a paid payment should go back to the student — money came in, but no
// new access did. Shown to the teacher until they mark it dealt with.
export const REFUND_REASON = {
  DUPLICATE: "duplicate",           // paid for a course they already had
  REVOKED_COURSE: "revoked_course", // the course was taken back after the payment started
} as const;

export type RefundReason = (typeof REFUND_REASON)[keyof typeof REFUND_REASON];

// Default currency for all pricing/payments.
export const DEFAULT_CURRENCY = "EGP" as const;
