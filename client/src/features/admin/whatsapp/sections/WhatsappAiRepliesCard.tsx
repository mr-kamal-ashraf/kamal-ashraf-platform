"use client";

import { useWhatsapp } from "../WhatsappProvider";

/**
 * The teacher's master switch for the AI support agent on the linked number.
 * ON  -> incoming messages are answered by the AI.
 * OFF -> incoming messages are ignored (parent reports / lesson alerts still send).
 */
export function WhatsappAiRepliesCard() {
  const { status, aiRepliesEnabled, aiBusy, setAiReplies } = useWhatsapp();

  // Nothing to control until the first status response has arrived.
  if (!status) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-foreground">
              رد الذكاء الاصطناعي على الرسائل
            </h2>
            <span
              className={
                "rounded-full px-2.5 py-1 text-[11px] font-bold " +
                (aiRepliesEnabled
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground")
              }
            >
              {aiRepliesEnabled ? "شغّال" : "متوقف"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {aiRepliesEnabled
              ? "الرقم المربوط بيرد تلقائيًا على أي رسالة بتوصله."
              : "الرقم المربوط مش هيرد على أي رسالة بتوصله. تقارير أولياء الأمور وتنبيهات الدروس لسه بتتبعت عادي."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={aiRepliesEnabled}
          aria-label="تشغيل أو إيقاف رد الذكاء الاصطناعي"
          onClick={() => setAiReplies(!aiRepliesEnabled)}
          disabled={aiBusy}
          dir="ltr"
          className={
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 " +
            (aiRepliesEnabled ? "bg-emerald-500" : "bg-muted-foreground/30")
          }
        >
          <span
            className={
              "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform " +
              (aiRepliesEnabled ? "translate-x-6" : "translate-x-1")
            }
          />
        </button>
      </div>
    </div>
  );
}
