"use client";

import { useMemo, useRef } from "react";
import { FormSection } from "../../components/FormSection";
import { useNewLesson } from "../NewLessonProvider";

export function NewLessonThumbnail() {
  const { thumbnailFile, setThumbnailFile } = useNewLesson();
  const inputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => {
    if (!thumbnailFile) return null;
    return URL.createObjectURL(thumbnailFile);
  }, [thumbnailFile]);

  return (
    <FormSection title="صورة الدرس المصغّرة" optional>
      <p className="text-xs text-muted-foreground">
        صورة مربّعة أو أفقية بأبعاد ١٢٨٠×٧٢٠ تظهر في كارت الدرس على الصفحة
        الرئيسية. لو لم ترفع صورة، سيُستخدم تدرّج لوني افتراضي حسب المرحلة.
        الصورة بتترفع بعد حفظ الدرس.
      </p>
      <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="معاينة الصورة"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs text-muted-foreground">لا توجد صورة</span>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
            className="block w-full text-xs file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-4 file:py-2 file:text-xs file:font-bold hover:file:bg-muted"
          />
          {thumbnailFile && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all text-xs text-muted-foreground">
                {thumbnailFile.name} —{" "}
                {(thumbnailFile.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => {
                  setThumbnailFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600 hover:bg-red-500/20"
              >
                حذف
              </button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            الصيغ المسموحة: JPG / PNG / WEBP — أقصى حجم ٥ ميجا.
          </p>
        </div>
      </div>
    </FormSection>
  );
}
