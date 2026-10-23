import type { Response } from "express";

/**
 * Helper functions for sending consistent JSON responses.
 *
 * Every API response (success or error) follows the same shape so the
 * frontend always knows where to find the data and how to detect failures.
 *
 * Success shape:  { success: true,  message, data, [meta] }
 * Error shape:    { success: false, message, code, details, statusCode }
 */

interface SuccessOptions<T> {
  message?: string;                   // Human-readable result description
  data?: T;                           // The actual payload
  statusCode?: number;                // Defaults to 200
  meta?: Record<string, unknown>;     // Optional pagination / extra info
}

/** Send a successful JSON response. */
export function sendSuccess<T>(res: Response, options: SuccessOptions<T> = {}) {
  const { message = "Success", data, statusCode = 200, meta } = options;
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
    ...(meta ? { meta } : {}),   // only include `meta` key if it has content
  });
}

interface ErrorOptions {
  message: string;          // Human-readable description of what went wrong
  statusCode?: number;      // HTTP status code (defaults to 500)
  code?: string;            // Machine-readable error code for the frontend
  details?: unknown;        // Optional field-level validation errors etc.
}

/** Send an error JSON response. Used exclusively by the error middleware. */
export function sendError(res: Response, options: ErrorOptions) {
  const { message, statusCode = 500, code, details } = options;
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    details,
    statusCode,
  });
}
