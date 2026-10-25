"use client";

import Image from "next/image";
import { useWhatsapp } from "../WhatsappProvider";

/**
 * Shows the QR to scan while the bridge is waiting to be linked, plus short
 * step-by-step instructions. Also renders friendly guidance for the other
 * transient states so the teacher always knows what to do next.
 */
export function WhatsappQrCard() {
  const { status, qr } = useWhatsapp();

  // Nothing useful to show here once connected — the status card covers it.
  if (status === "connected" || status === "disabled" || status === null) {
    return null;
  }

  if (status === "qr" && qr) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-bold text-foreground">اربط الرقم دلوقتي</h2>
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="w-full max-w-[260px] rounded-2xl border border-border bg-white p-3">
            {/* the code is generated on the spot (a data: URL), nothing to resize */}
            <Image
              src={qr}
              alt="امسح كود واتساب"
              width={260}
              height={260}
              unoptimized
              className="h-auto w-full"
            />
          </div>
          <ol className="flex-1 space-y-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            <li>1) افتح واتساب على الموبايل اللي فيه رقم المنصة.</li>
            <li>2) روح على: الإعدادات ← الأجهزة المرتبطة.</li>
            <li>3) اضغط &quot;ربط جهاز&quot; وامسح الكود ده.</li>
            <li>
              الكود بيتجدّد لوحده كل شوية — لو خلص وقته استنى ثانية وهيظهر واحد
              جديد.
            </li>
          </ol>
        </div>
      </div>
    );
  }

  const message =
    status === "logged_out"
      ? "الرقم اتفصل. جاري تجهيز كود جديد للربط — استنى لحظات."
      : status === "disconnected"
        ? "الاتصال اتقطع، وبيحاول يرجع لوحده. لو استمر، جرّب إعادة التشغيل."
        : "جاري تجهيز الاتصال... استنى لحظات وهيظهر كود الربط أو يتصل لوحده.";

  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
      {message}
    </div>
  );
}
