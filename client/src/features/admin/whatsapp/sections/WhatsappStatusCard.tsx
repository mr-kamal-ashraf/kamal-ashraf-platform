"use client";

import type { WhatsappStatus } from "@/api/admin/whatsapp";
import { useWhatsapp } from "../WhatsappProvider";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

const STATUS_META: Record<
  WhatsappStatus,
  { label: string; className: string }
> = {
  connected: { label: "متصل", className: "bg-emerald-500/10 text-emerald-600" },
  qr: { label: "في انتظار المسح", className: "bg-amber-500/10 text-amber-600" },
  connecting: { label: "جاري الاتصال", className: "bg-blue-500/10 text-blue-600" },
  init: { label: "جاري التجهيز", className: "bg-blue-500/10 text-blue-600" },
  disconnected: {
    label: "انقطع — بيحاول يرجع",
    className: "bg-amber-500/10 text-amber-600",
  },
  logged_out: { label: "غير مربوط", className: "bg-red-500/10 text-red-600" },
  disabled: { label: "متوقف", className: "bg-muted text-muted-foreground" },
  error: { label: "خطأ", className: "bg-red-500/10 text-red-600" },
};

export function WhatsappStatusCard() {
  const { status, phone, since, lastError, isLoading, error, busy, logout, restart } =
    useWhatsapp();

  if (isLoading && !status) return <LoadingScreen variant="page" />;

  if (error && !status) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  const meta = status ? STATUS_META[status] : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">حالة الاتصال</span>
          {meta && (
            <span
              className={
                "rounded-full px-2.5 py-1 text-[11px] font-bold " + meta.className
              }
            >
              {meta.label}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={restart}
            disabled={busy !== null || status === "disabled"}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            {busy === "restart" ? "جاري..." : "إعادة تشغيل"}
          </button>
          <button
            type="button"
            onClick={logout}
            disabled={busy !== null || status === "disabled"}
            className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            {busy === "logout" ? "جاري..." : "فصل / تغيير الرقم"}
          </button>
        </div>
      </div>

      {status === "connected" && (
        <dl className="mt-4 grid gap-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">الرقم المربوط (بيرسل منه)</dt>
            <dd dir="ltr" className="font-bold text-foreground">
              {phone ? `+${phone}` : "—"}
            </dd>
          </div>
          {since && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">متصل منذ</dt>
              <dd className="font-bold text-foreground">
                {new Date(since).toLocaleString("ar-EG")}
              </dd>
            </div>
          )}
        </dl>
      )}

      {status === "disabled" && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          خدمة الواتساب متوقفة على السيرفر (‏WHATSAPP_BRIDGE_ENABLED=false‏). فعّلها من
          إعدادات الاستضافة عشان تقدر تربط رقم.
        </p>
      )}

      {status === "error" && lastError && (
        <p className="mt-3 text-xs leading-relaxed text-red-600">{lastError}</p>
      )}
    </div>
  );
}
