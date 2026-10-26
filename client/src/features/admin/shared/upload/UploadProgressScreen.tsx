"use client";

import { useEffect } from "react";
import { BrandLogo } from "@/shared/components/BrandLogo";
import { formatBytes, formatTimeLeft, type UploadProgress } from "./useUploadProgress";

interface UploadProgressScreenProps {
  /** While the file goes out: "بنرفع فيديو الدرس". */
  title: string;
  /** Once it's all out and the server is storing it. */
  savingTitle: string;
  progress: UploadProgress | null;
  /** Stops sending (shown only while sending). */
  onCancel?: () => void;
}

/**
 * Covers the page during a big upload, in the platform's loading look (see
 * LoadingScreen), but with the real numbers: how far, how much, how long is
 * left. Leaving the page asks first — it would cut the upload.
 */
export function UploadProgressScreen({
  title,
  savingTitle,
  progress,
  onCancel,
}: UploadProgressScreenProps) {
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const total = progress?.total ?? 0;
  const ratio = total > 0 ? Math.min(1, (progress?.sent ?? 0) / total) : 0;
  const sending = !progress || total === 0 || ratio < 1;
  const percent = Math.floor(ratio * 100);
  const timeLeft = progress && sending ? formatTimeLeft(progress) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={sending ? title : savingTitle}
      className="brand-loader--page fixed inset-0 z-200 flex items-center justify-center px-4"
    >
      <div className="brand-loader__ring">
        <div aria-hidden className="brand-loader__logo">
          <BrandLogo className="h-12 sm:h-14" />
        </div>
        <p className="mt-3 text-lg font-extrabold text-primary sm:text-xl">
          {sending ? title : savingTitle}
        </p>
        {sending ? (
          <>
            <p aria-hidden className="text-4xl font-black tabular-nums text-foreground sm:text-5xl">
              <bdi>{percent}%</bdi>
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={title}
              className="brand-loader__meter"
              style={{ "--progress": ratio } as React.CSSProperties}
            >
              <span />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              {total > 0 ? (
                <>
                  <bdi>{formatBytes(progress?.sent ?? 0)}</bdi> من <bdi>{formatBytes(total)}</bdi>
                  {timeLeft && <> · {timeLeft}</>}
                </>
              ) : (
                "بنبدأ الرفع..."
              )}
            </p>
          </>
        ) : (
          <>
            <p className="max-w-xs text-sm text-muted-foreground">
              الفيديو وصل كله — ثواني وهيخلص.
            </p>
            <div aria-hidden className="brand-loader__bar">
              <span />
            </div>
          </>
        )}
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          سيب الصفحة دي مفتوحة لحد ما يخلص.
        </p>
        {onCancel && sending && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-1 rounded-lg px-3 py-1.5 text-xs font-bold text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            إلغاء الرفع
          </button>
        )}
      </div>
    </div>
  );
}
