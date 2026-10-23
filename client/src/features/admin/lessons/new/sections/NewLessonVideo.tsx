"use client";

import { useRef } from "react";
import { FormSection } from "../../components/FormSection";
import { useNewLesson } from "../NewLessonProvider";

export function NewLessonVideo() {
  const { videoFile, setVideoFile, errors } = useNewLesson();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <FormSection title="ملف الفيديو">
      <p className="text-xs text-muted-foreground">
        اختيار ملف فيديو إلزامي. هيترفع بعد إنشاء الدرس، ومش هينفع تنشر الدرس
        للطلاب من غير فيديو مرفوع.
      </p>
      <div data-invalid={errors.video ? "true" : undefined}>
        <input
          ref={inputRef}
          name="lessonVideo"
          type="file"
          required
          accept="video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.wmv,.mpg,.mpeg,.mts,.m2ts,.flv,.ogv,.ts"
          onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-4 file:py-2 file:text-sm file:font-bold hover:file:bg-muted"
        />
        {errors.video && (
          <p role="alert" className="mt-1.5 text-xs font-semibold text-destructive">
            {errors.video}
          </p>
        )}
      </div>
      {videoFile && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-all text-xs text-muted-foreground">
            {videoFile.name} — {(videoFile.size / 1024 / 1024).toFixed(1)} MB
          </span>
          <button
            type="button"
            onClick={() => {
              setVideoFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600 hover:bg-red-500/20"
          >
            إزالة
          </button>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        الصيغ الشائعة: MP4 و MOV و WEBM و MKV و AVI و M4V و WMV و MPEG و TS — أقصى
        حجم ٢ جيجا. لو نظام التشغيل رفض يحدد النوع، غالباً هيتقبل كـ فيديو بعد
        الرفع.
      </p>
    </FormSection>
  );
}
