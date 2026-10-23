import { toast } from "sonner";
import { isApiError } from "@/api";

/**
 * An error turned into words the teacher can act on. `technical` is a short
 * note for the developer (status / code / path) — shown only behind a
 * "details" toggle, never as the main message.
 */
export interface FriendlyError {
  title: string;
  message: string;
  technical?: string;
  /** The admin session is gone — offer a "log in again" action. */
  needsLogin?: boolean;
}

const CONTACT_DEV = "ولو المشكلة فضلت موجودة كلّم المطوّر.";

export function describeAdminError(err: unknown): FriendlyError {
  if (!isApiError(err)) {
    return {
      title: "حصلت مشكلة غير متوقعة",
      message: `حدّث الصفحة وجرّب تاني. ${CONTACT_DEV}`,
      technical: err instanceof Error ? err.message : String(err),
    };
  }

  const { statusCode: status, code } = err;
  const path =
    err.details && typeof err.details === "object" && "path" in err.details
      ? ` ${String((err.details as { path: unknown }).path)}`
      : "";
  const technical = `HTTP ${status}${code ? ` · ${code}` : ""}${path}`;

  if (code === "REQUEST_ABORTED") {
    return { title: "اتلغى الطلب", message: "جرّب تاني.", technical };
  }
  if (status === 0 || code === "NETWORK_ERROR") {
    return {
      title: "مش قادرين نوصل للمنصة",
      message: "اتأكد إن النت شغال وجرّب تاني. لو النت شغال والمشكلة مستمرة — كلّم المطوّر.",
      technical,
    };
  }
  if (code === "ROUTE_NOT_FOUND") {
    return {
      title: "الخاصية دي لسه مش متاحة",
      message: "المنصة محتاجة تتحدّث لآخر نسخة — كلّم المطوّر.",
      technical,
    };
  }
  if (status === 401) {
    return {
      title: "الجلسة انتهت",
      message: "سجّل دخول تاني (في تاب جديد) وبعدها ارجع هنا وكمّل — التعديلات اللي في الصفحة مش هتضيع.",
      technical,
      needsLogin: true,
    };
  }
  if (status >= 500) {
    return {
      title: "حصلت مشكلة في المنصة",
      message: `${err.message} ${CONTACT_DEV}`,
      technical,
    };
  }
  // 400 / 403 / 404 / 409 / 413 / 422 / 429 — the server already sends a
  // specific Arabic sentence ("لينك فيسبوك لازم يبدأ بـ https://", …).
  return { title: err.message, message: "", technical };
}

/** Shows an error as a toast, with a "log in" action when the session expired. */
export function toastAdminError(err: unknown): FriendlyError {
  const f = describeAdminError(err);
  toast.error(f.title, {
    description: f.message || undefined,
    duration: f.message ? 8000 : 5000,
    action: f.needsLogin
      ? { label: "سجّل دخول", onClick: () => window.open("/admin/login", "_blank") }
      : undefined,
  });
  return f;
}
