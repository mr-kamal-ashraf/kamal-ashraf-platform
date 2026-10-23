"use client";

import { useMemo, useRef, useState } from "react";
import { resolveAssetUrl } from "@/config/env";
import { useEditLesson } from "../EditLessonProvider";

export function EditLessonThumbnail() {
  const {
    lesson,
    uploadingThumbnail,
    uploadThumbnail,
    clearThumbnail,
  } = useEditLesson();
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const localPreview = useMemo(() => {
    if (!thumbnailFile) return null;
    return URL.createObjectURL(thumbnailFile);
  }, [thumbnailFile]);

  const remoteUrl = useMemo(
    () => (lesson ? resolveAssetUrl(lesson.thumbnail) : null),
    [lesson],
  );

  if (!lesson) return null;

  const handleUpload = () => {
    if (!thumbnailFile) return;
    uploadThumbnail(thumbnailFile, () => {
      setThumbnailFile(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <h2 className="mb-4 text-base font-extrabold sm:text-lg">
        صورة الدرس المصغّرة
      </h2>
      <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-start">
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
          {localPreview ? (
            <img
              src={localPreview}
              alt="معاينة جديدة"
              className="h-full w-full object-cover"
            />
          ) : remoteUrl ? (
            <img
              src={remoteUrl}
              alt={lesson.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-2 text-center text-xs text-muted-foreground">
              لا توجد صورة — يستخدم التدرّج الافتراضي
            </span>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            الصورة بتظهر في كارت الدرس، والفيديو بيترفع بشكل منفصل.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
            className="block w-full text-xs file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-4 file:py-2 file:text-xs file:font-bold hover:file:bg-muted"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploadingThumbnail || !thumbnailFile}
              className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {uploadingThumbnail ? "جارٍ الرفع..." : "حفظ الصورة"}
            </button>
            {lesson.thumbnail && (
              <button
                type="button"
                onClick={clearThumbnail}
                className="min-h-[44px] rounded-lg bg-red-500/10 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-500/20"
              >
                حذف الصورة الحالية
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            الصيغ المسموحة: JPG / PNG / WEBP — أقصى حجم ٥ ميجا.
          </p>
        </div>
      </div>
    </section>
  );
}
