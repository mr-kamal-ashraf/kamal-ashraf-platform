/**
 * Custom error class for all intentional API errors.
 *
 * Separates "operational" errors (expected problems like wrong password,
 * not found, validation failure) from "programmer" errors (unexpected bugs).
 *
 * The global error middleware checks `instanceof ApiError` to format the
 * response correctly; all other errors become generic 500s.
 *
 * Usage:
 *   throw ApiError.notFound("الدرس غير موجود", "LESSON_NOT_FOUND");
 */
export class ApiError extends Error {
  public readonly statusCode: number;   // HTTP status to send in the response
  public readonly code?: string;        // Machine-readable error code for the frontend
  public readonly details?: unknown;    // Optional extra data (e.g. validation field errors)
  public readonly isOperational: boolean; // false = bug; true = expected operational error

  constructor(
    statusCode: number,
    message: string,
    options?: { code?: string; details?: unknown; isOperational?: boolean },
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = options?.code;
    this.details = options?.details;
    // Default to operational so the error middleware doesn't log a full stack trace.
    this.isOperational = options?.isOperational ?? true;
    // Removes the constructor call from the stack trace for cleaner logs.
    Error.captureStackTrace?.(this, this.constructor);
  }

  // ── Static factory helpers (preferred over calling `new ApiError(...)` directly) ──

  /** 400 — bad input from the client (invalid format, missing required field, etc.) */
  static badRequest(message: string, code?: string, details?: unknown) {
    return new ApiError(400, message, { code, details });
  }

  /** 401 — the request has no valid authentication credentials. */
  static unauthorized(message = "لازم تسجّل دخول الأول.", code?: string) {
    return new ApiError(401, message, { code });
  }

  /** 403 — authenticated but not permitted (wrong role, suspended account, etc.) */
  static forbidden(message = "الصفحة دي مش متاحة لحسابك.", code?: string, details?: unknown) {
    return new ApiError(403, message, { code, details });
  }

  /** 404 — the requested resource does not exist. */
  static notFound(message = "الحاجة اللي بتدوّر عليها مش موجودة.", code?: string) {
    return new ApiError(404, message, { code });
  }

  /** 409 — conflict with existing data (e.g. duplicate phone number). */
  static conflict(message: string, code?: string) {
    return new ApiError(409, message, { code });
  }

  /** 429 — rate limit exceeded or account temporarily locked. */
  static tooManyRequests(message = "طلبات كتير في وقت قصير — استنى شوية وحاول تاني.", code?: string) {
    return new ApiError(429, message, { code });
  }

  /** 500 — unexpected server error. isOperational=false triggers full stack trace logging. */
  static internal(message = "حصل خطأ غير متوقع، حاول تاني بعد شوية.") {
    return new ApiError(500, message, { isOperational: false });
  }
}
