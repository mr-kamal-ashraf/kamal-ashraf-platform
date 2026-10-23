import type { Stage } from "@/shared/lib/stage";

export type { Stage };

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  code?: string;
  details?: unknown;
  statusCode?: number;
  meta?: Record<string, unknown>;
}

/**
 * How much of what the teacher published THIS MONTH a student actually watched.
 * `level` is null when nothing was published in their courses this month — that
 * is "no data", not a weak student.
 */
export type CommitmentLevel = "high" | "medium" | "low";

export interface StudentCommitment {
  releasedLessons: number;
  watchedLessons: number;
  percentage: number;
  level: CommitmentLevel | null;
}

export interface User {
  _id: string;
  firstName: string;
  secondName: string;
  thirdName: string;
  fullName?: string;
  studentPhone: string;
  parentPhone: string;
  stage: Stage;
  isActive: boolean;
  isSuspended: boolean;
  /** True when the student owns at least one active course. */
  hasOwnedCourse?: boolean;
  lastLoginAt: string | null;
  /** Present on the admin student list; absent on the student's own profile. */
  commitment?: StudentCommitment;
  createdAt: string;
  updatedAt: string;
}

export interface Admin {
  _id: string;
  email: string;
  name: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeResponse {
  user: User;
}

export interface Lesson {
  _id: string;
  courseId: string;
  title: string;
  slug: string;
  description: string;
  longDescription: string;
  stage: Stage;
  durationMinutes: number;
  chapters: number;
  topics: string[];
  bunnyVideoId: string | null;
  videoDurationSeconds: number;
  /** Where the video is on Bunny (admin only; null: none, or not checked yet). */
  videoStatus?: VideoStatus | null;
  thumbnail: string | null;
  thumbnailGradient: string | null;
  isPublished: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Bunny keeps converting a video for a while after the upload; it plays once "ready". */
export type VideoStatus = "processing" | "ready" | "failed";

export interface LessonVideoStatus {
  videoStatus: VideoStatus | null;
  videoDurationSeconds: number;
  /** 0–100 while converting, when Bunny reported it. */
  encodeProgress: number | null;
}

export interface LessonPreview {
  _id: string;
  title: string;
  slug: string;
  description: string;
  longDescription: string;
  stage: Stage;
  durationMinutes: number;
  chapters: number;
  topics: string[];
  thumbnail: string | null;
  thumbnailGradient: string | null;
}

export interface LessonProgressInfo {
  lastWatchedSecond: number;
  totalSeconds?: number;
  watchedPercentage: number;
  isCompleted: boolean;
}

export interface VideoUrlResponse {
  url: string;
  videoId: string;
  durationSeconds: number;
}

export interface DashboardStats {
  students: {
    total: number;
    active: number;
    pendingActivation: number;
    suspended: number;
    byStage: Record<string, number>;
  };
  enrollments: {
    active: number;
    studentsWithCourses: number;
  };
  sales: {
    currency: string;
    totalRevenue: number;
    monthRevenue: number;
    salesCount: number;
    monthSalesCount: number;
  };
  lessons: {
    total: number;
    published: number;
    draft: number;
  };
  /** Paid payments still waiting to be refunded (the sales section lists them). */
  refundAlerts: number;
  generatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogEntry {
  _id: string;
  adminId: { _id: string; email: string; name: string } | string;
  action: string;
  targetUserId?:
    | {
        _id: string;
        firstName: string;
        secondName: string;
        thirdName: string;
        studentPhone: string;
      }
    | string
    | null;
  targetLessonId?: string | null;
  targetSubscriptionId?: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface WatchHistoryItem {
  _id: string;
  lessonId: {
    _id: string;
    title: string;
    slug: string;
    stage: Stage;
    durationMinutes: number;
    thumbnail: string | null;
  };
  lastWatchedSecond: number;
  watchedPercentage: number;
  isCompleted: boolean;
  lastWatchedAt: string;
  completedAt: string | null;
}

export interface ActiveSessionItem {
  _id: string;
  deviceLabel: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
}

export interface StudentDetail {
  user: User;
  enrollments: EnrollmentRecord[];
  watchHistory: WatchHistoryItem[];
  activeSessions: ActiveSessionItem[];
}

export type ApiErrorCode =
  | "NOT_AUTHENTICATED"
  | "ACCOUNT_NOT_ACTIVATED"
  | "ACCOUNT_SUSPENDED"
  | "NO_SUBSCRIPTION"
  | "SUBSCRIPTION_EXPIRED"
  | "STAGE_MISMATCH"
  | "LESSON_NOT_PUBLISHED"
  | "LESSON_NOT_FOUND"
  | "NOT_ENROLLED"
  | "COURSE_NOT_FOUND"
  | "COURSE_NOT_PUBLISHED"
  | "ALREADY_OWNED"
  | "PAYMOB_NOT_CONFIGURED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "PHONE_ALREADY_REGISTERED"
  | "VALIDATION_ERROR"
  | "RATE_LIMIT_EXCEEDED";

// ── Courses / enrollments / payments (course-purchase system) ────────────────

export type EnrollmentSource = "paymob" | "cash" | "code";
export type EnrollmentStatus = "active" | "revoked";
export type PaymentStatus = "pending" | "paid" | "failed";

export interface Course {
  _id: string;
  title: string;
  slug: string;
  description: string;
  longDescription: string;
  stage: Stage;
  price: number;
  thumbnail: string | null;
  thumbnailGradient: string | null;
  isPublished: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Admin list row — a course with its lesson counts. */
export interface CourseAdminItem extends Course {
  lessonsCount: number;
  publishedLessonsCount: number;
}

/** Student-facing course card. */
export interface CourseCard {
  _id: string;
  title: string;
  slug: string;
  description: string;
  stage: Stage;
  price: number;
  thumbnail: string | null;
  thumbnailGradient: string | null;
  lessonsCount: number;
  owned?: boolean;
}

/** A lesson row inside a course detail — locked unless owned. */
export interface CourseLessonRow {
  _id: string;
  title: string;
  slug: string;
  description: string;
  durationMinutes: number;
  chapters: number;
  order: number;
  thumbnail: string | null;
  thumbnailGradient: string | null;
  hasVideo: boolean;
  locked: boolean;
}

export interface CourseDetailResponse {
  course: {
    _id: string;
    title: string;
    slug: string;
    description: string;
    longDescription: string;
    stage: Stage;
    price: number;
    thumbnail: string | null;
    thumbnailGradient: string | null;
  };
  owned: boolean;
  canBuy: boolean;
  lessons: CourseLessonRow[];
}

/** An enrollment as shown in the admin student-detail page. */
export interface EnrollmentRecord {
  _id: string;
  courseId:
    | {
        _id: string;
        title: string;
        slug: string;
        stage: Stage;
        price: number;
        thumbnail: string | null;
        thumbnailGradient: string | null;
        isPublished: boolean;
      }
    | string;
  stage: Stage;
  source: EnrollmentSource;
  amountPaid: number;
  status: EnrollmentStatus;
  notes: string | null;
  createdAt: string;
}

/** How a student pays online (all through Paymob). */
export type PaymentMethod = "card" | "wallet";

export interface CheckoutResponse {
  free?: boolean;
  method?: PaymentMethod;
  paymentId?: string;
  /** Our order reference — the result page checks the payment by it. */
  merchantOrderId?: string;
  /** card, embedded: renders Paymob's card fields inside our checkout. */
  pixel?: { publicKey: string; clientSecret: string };
  /** card, otherwise: Paymob's checkout page. */
  iframeUrl?: string;
  /** wallet: the wallet provider's confirmation page (PIN / OTP). */
  redirectUrl?: string;
  paymentToken?: string;
  amount: number;
  courseId: string;
  courseSlug: string;
}

export interface PaymentRecord {
  _id: string;
  courseId:
    | { _id: string; title: string; slug: string; stage: Stage; thumbnail: string | null }
    | string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
}
