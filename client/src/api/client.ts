import { API_URL } from "@/config/env";
import type { ApiResponse } from "./types";

export interface ApiError extends Error {
  isApiError: true;
  statusCode: number;
  code?: string;
  details?: unknown;
}

export function createApiError(
  message: string,
  statusCode: number,
  code?: string,
  details?: unknown,
): ApiError {
  const err = new Error(message) as ApiError;
  err.name = "ApiError";
  err.isApiError = true;
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

export function isApiError(err: unknown): err is ApiError {
  return (
    err !== null &&
    typeof err === "object" &&
    (err as { isApiError?: unknown }).isApiError === true
  );
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  skipAuthRefresh?: boolean;
}

// Student and admin credentials live in different cookie pairs. Keeping one
// shared refresh promise made an expired request in one context wait for a
// refresh of the other context, then retry with its own still-expired token.
// Each role now coalesces only its own refresh requests.
let refreshingStudent: Promise<boolean> | null = null;
let refreshingAdmin: Promise<boolean> | null = null;

async function tryRefresh(isAdmin: boolean): Promise<boolean> {
  const current = isAdmin ? refreshingAdmin : refreshingStudent;
  if (current) return current;

  const endpoint = isAdmin ? "/admin/auth/refresh" : "/auth/refresh";
  const refreshRequest = (async () => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    return response.ok;
  })();

  if (isAdmin) refreshingAdmin = refreshRequest;
  else refreshingStudent = refreshRequest;

  try {
    return await refreshRequest;
  } finally {
    if (isAdmin && refreshingAdmin === refreshRequest) refreshingAdmin = null;
    if (!isAdmin && refreshingStudent === refreshRequest) refreshingStudent = null;
  }
}

/**
 * Which session a request belongs to — decides whose refresh token gets used
 * when an access token has expired. Everything under /admin/ is the admin
 * panel's, but so are the AI curriculum/exam tools (/ai/upload-curriculum,
 * /ai/curriculum, /ai/exam-generator, /ai/exams…): only the student chat
 * (/ai/student-chat…) belongs to a student. Judging by "/admin/" alone sent those
 * admin calls to the STUDENT refresh after the panel had been left idle, which
 * has nothing to renew, so the teacher got "لازم تسجّل دخول" instead of the
 * session being quietly renewed.
 */
function isAdminEndpoint(endpoint: string): boolean {
  if (endpoint.startsWith("/admin/")) return true;
  return (
    endpoint.startsWith("/ai/") && !endpoint.startsWith("/ai/student-chat")
  );
}

/**
 * True when a rejected fetch was caused by an abort rather than a real
 * network problem. Checks the signal too, because a few environments reject
 * with a plain Error instead of a DOMException named AbortError.
 */
function isAbortError(err: unknown, signal: AbortSignal | null | undefined): boolean {
  if (signal?.aborted) return true;
  return (
    err instanceof DOMException
      ? err.name === "AbortError"
      : err instanceof Error && err.name === "AbortError"
  );
}

function buildQuery(query: RequestOptions["query"]): string {
  if (!query) return "";
  const entries = Object.entries(query).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return "";
  const params = new URLSearchParams();
  for (const [k, v] of entries) {
    params.append(k, String(v));
  }
  return `?${params.toString()}`;
}

/**
 * User-facing fallback used ONLY when the server didn't send a message we
 * could show (proxy 502, gateway HTML page, etc.). Every "normal" API error
 * response already carries a friendly Arabic `message` from the backend's
 * error middleware — this exists so a broken pipe never surfaces raw status
 * codes to a teacher/student.
 */
function genericFallbackMessage(status: number): string {
  if (status === 0) return "تعذّر الاتصال بالسيرفر — راجع الإنترنت وحاول تاني.";
  if (status === 401) return "الجلسة انتهت، من فضلك سجّل الدخول تاني.";
  if (status === 403) return "الصفحة دي مش متاحة لحسابك.";
  if (status === 404) return "الحاجة اللي بتحاول تفتحها مش موجودة.";
  if (status === 413) return "الملف كبير جداً، من فضلك ارفع ملف أصغر.";
  if (status === 429) return "حاول تاني بعد شوية — بعت طلبات كتيرة في وقت قصير.";
  if (status >= 500) return "حصل خطأ مؤقت في السيرفر، جرّب تاني بعد شوية.";
  return "حصل خطأ غير متوقع، جرّب تاني.";
}

/** Deep copy so a second `fetch()` after 401 refresh can send the file again. */
function cloneFormData(source: FormData): FormData {
  const copy = new FormData();
  for (const [key, value] of source.entries()) {
    copy.append(key, value);
  }
  return copy;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, query, skipAuthRefresh, headers, ...rest } = options;
  const isAdminPath = isAdminEndpoint(endpoint);

  const url = `${API_URL}${endpoint}${buildQuery(query)}`;

  const init: RequestInit = {
    ...rest,
    credentials: "include",
    // API responses depend on the current HttpOnly session cookies. Reusing a
    // cached anonymous response here can make an owner look unsubscribed even
    // after the session has been restored.
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };

  let formDataRetryBody: FormData | undefined;
  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = cloneFormData(body);
      formDataRetryBody = cloneFormData(body);
      delete (init.headers as Record<string, string>)["Content-Type"];
    } else {
      init.body = JSON.stringify(body);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    // fetch() throws BEFORE any HTTP response — DNS failure, offline, CORS,
    // or the caller aborting on purpose. A deliberate abort is NOT a failure,
    // so it gets its own code: telling a user "راجع الإنترنت" after they
    // pressed stop would be plain wrong.
    if (isAbortError(err, init.signal)) {
      throw createApiError("تم إلغاء الطلب.", 0, "REQUEST_ABORTED");
    }
    throw createApiError(
      "تعذّر الاتصال بالسيرفر — راجع الإنترنت وحاول تاني.",
      0,
      "NETWORK_ERROR",
    );
  }

  // The 401-refresh path above swallows its own errors, so an abort landing
  // mid-refresh would otherwise surface as "session expired".
  if (init.signal?.aborted) {
    throw createApiError("تم إلغاء الطلب.", 0, "REQUEST_ABORTED");
  }

  if (
    response.status === 401 &&
    !skipAuthRefresh &&
    !endpoint.includes("/auth/login") &&
    !endpoint.includes("/auth/refresh") &&
    !endpoint.includes("/auth/register")
  ) {
    try {
      const refreshed = await tryRefresh(isAdminPath);
      if (refreshed) {
        if (formDataRetryBody) {
          init.body = formDataRetryBody;
        }
        response = await fetch(url, init);
      }
    } catch {
      // ignore — original 401 will be reported below
    }
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    // Non-JSON response — treat as error
  }

  if (!response.ok) {
    // The backend's error middleware guarantees a friendly Arabic `message`
    // on every error response. If it's missing (rare — proxy 502, CORS
    // preflight failure, non-JSON gateway page) fall back to a generic
    // Arabic sentence, NOT the raw status code.
    throw createApiError(
      payload?.message || genericFallbackMessage(response.status),
      response.status,
      payload?.code,
      payload?.details,
    );
  }

  return (payload?.data as T) ?? (null as unknown as T);
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "POST", body }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PATCH", body }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PUT", body }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};
