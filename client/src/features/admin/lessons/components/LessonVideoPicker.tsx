"use client";

import { useEffect, useState } from "react";
import { FileDrop } from "@/features/admin/shared/form/FileDrop";
import { formatBytes } from "@/features/admin/shared/upload/useUploadProgress";

export const VIDEO_ACCEPT =
  "video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.wmv,.mpg,.mpeg,.mts,.m2ts,.flv,.ogv,.ts";
const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * A picked video's length in seconds, read on this device from the file's
 * header (nothing is uploaded) — null while reading, or when the browser
 * can't tell (some formats).
 */
export function useVideoFileSeconds(file: File | null): number | null {
  const [read, setRead] = useState<{ file: File; seconds: number | null } | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    let done = false;
    const finish = (seconds: number | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(giveUp);
      setRead({ file, seconds });
      video.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
    const giveUp = window.setTimeout(() => finish(null), 8000);
    video.onloadedmetadata = () =>
      finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null);
    video.onerror = () => finish(null);
    video.src = url;
    return () => {
      done = true;
      window.clearTimeout(giveUp);
      video.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [file]);
  return read?.file === file ? read.seconds : null;
}

/** 2710 → "45 دقيقة", 3725 → "ساعة و2 دقيقة". */
export function formatVideoLength(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours === 1 ? "ساعة" : `${hours} ساعات`}${rest ? ` و${rest} دقيقة` : ""}`;
}

/** The lesson video: drop or pick one; shows its name, size and length. */
export function LessonVideoPicker({
  file,
  onFile,
  onClear,
  invalid,
  title = "اسحب فيديو الدرس هنا أو اختاره",
}: {
  file: File | null;
  onFile: (file: File) => void;
  onClear?: () => void;
  invalid?: boolean;
  title?: string;
}) {
  const seconds = useVideoFileSeconds(file);
  return (
    <FileDrop
      accept={VIDEO_ACCEPT}
      maxBytes={VIDEO_MAX_BYTES}
      onFile={onFile}
      onClear={onClear}
      invalid={invalid}
      icon="video"
      title={title}
      hint="MP4 أو MOV أو أي صيغة فيديو شائعة — لحد ٢ جيجا."
      wrongTypeMessage="الملف ده مش فيديو — اختار ملف فيديو (MP4 أو MOV مثلاً)."
      tooBigMessage="الفيديو أكبر من ٢ جيجا — صغّره وجرّب تاني."
      chosen={
        file ? (
          <span className="flex w-full items-center gap-3 pe-16 text-start">
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
            >
              <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-foreground" dir="auto">
                {file.name}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                <bdi>{formatBytes(file.size)}</bdi>
                {seconds ? <> · مدته {formatVideoLength(seconds)}</> : null}
                {" · "}
                <span className="font-bold text-primary">دوس عشان تغيّره</span>
              </span>
            </span>
          </span>
        ) : undefined
      }
    />
  );
}
