"use client";

import { useState } from "react";
import { toast } from "sonner";
import { adminWhatsappApi, isApiError } from "@/api";
import type { WhatsappSendTestResult } from "@/api/admin/whatsapp";
import { useWhatsapp } from "../WhatsappProvider";

/**
 * A manual test-send: enter any phone number + a message and fire it through
 * the linked number, to confirm the bridge works end-to-end.
 */
export function WhatsappTestCard() {
  const { status } = useWhatsapp();
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<WhatsappSendTestResult | null>(null);

  const connected = status === "connected";

  const onSend = async () => {
    if (!phone.trim() || !text.trim()) {
      toast.error("اكتب الرقم ونص الرسالة الأول");
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await adminWhatsappApi.sendTest(phone.trim(), text.trim());
      setResult(res);
      if (res.sent) {
        toast.success("تم إرسال الرسالة");
      } else {
        toast.error("لم تُرسل الرسالة — راجع التفاصيل تحت");
      }
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ أثناء الإرسال");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-foreground">تجربة إرسال</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        ابعت رسالة تجريبية لأي رقم للتأكد إن الربط شغّال.
      </p>

      {!connected && (
        <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-600">
          لازم الواتساب يكون متصل الأول عشان تقدر تبعت.
        </p>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-foreground">
            رقم الموبايل
          </label>
          <input
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01012345678"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-foreground">
            الرسالة
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="اكتب الرسالة التجريبية هنا..."
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
          />
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={sending || !connected}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {sending ? "جاري الإرسال..." : "إرسال رسالة تجريبية"}
        </button>

        {result && (
          <div
            className={
              "rounded-xl px-3 py-2 text-xs font-bold " +
              (result.sent
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-red-500/10 text-red-600")
            }
          >
            {result.sent
              ? `تم الإرسال بنجاح${result.messageId ? ` (‏${result.messageId}‏)` : ""}`
              : `لم تُرسل — ${result.reason}`}
          </div>
        )}
      </div>
    </div>
  );
}
