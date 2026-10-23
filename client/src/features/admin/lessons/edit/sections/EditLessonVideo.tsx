"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { useEditLesson } from "../EditLessonProvider";

/** 3725 → "1:02:05", 95 → "1:35". */
function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = String(totalSeconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function EditLessonVideo() {
  const { lesson, uploadingVideo, uploadVideo, videoProgress } = useEditLesson();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!lesson) return null;

  const handleUpload = () => {
    if (!videoFile) {
      toast.error("اختار ملف فيديو الأول");
      return;
    }
    uploadVideo(videoFile, () => {
      setVideoFile(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <h2 className="mb-4 text-base font-extrabold sm:text-lg">ملف الفيديو</h2>
      {uploadingVideo && (
        <LoadingScreen variant="overlay" label="جارٍ رفع الفيديو" hint="ممكن ياخد كام دقيقة حسب حجم الفيديو — سيب الصفحة مفتوحة لحد ما يخلص." />
      )}
      {lesson.bunnyVideoId && lesson.videoStatus === "ready" ? (
        <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="text-sm font-bold text-emerald-700">
            ✓ الفيديو مرفوع وجاهز
          </div>
          <div className="text-xs text-muted-foreground">
            المدة:{" "}
            {lesson.videoDurationSeconds ? (
              <bdi dir="ltr">{formatDuration(lesson.videoDurationSeconds)}</bdi>
            ) : (
              "—"
            )}
          </div>
        </div>
      ) : lesson.bunnyVideoId && lesson.videoStatus === "failed" ? (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm font-bold text-red-700">
          ✗ الفيديو ده فيه مشكلة ومش هيشتغل للطلاب — ارفعه تاني من تحت.
        </div>
      ) : lesson.bunnyVideoId ? (
        <div role="status" className="space-y-1 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-sky-700">
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-600"
            />
            {lesson.videoStatus === "processing"
              ? `الفيديو اترفع وبيتجهز دلوقتي${videoProgress ? ` (${videoProgress}%)` : "..."}`
              : "بنتأكد إن الفيديو جاهز..."}
          </div>
          <div className="text-xs text-muted-foreground">
            هتقدر تنشر الدرس أول ما يخلص — الصفحة بتتحدث لوحدها.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-500/5 p-4 text-sm text-amber-700">
          مفيش فيديو مرفوع لسه. ارفع الفيديو هنا.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          ref={inputRef}
          type="file"
          accept="video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.wmv,.mpg,.mpeg,.mts,.m2ts,.flv,.ogv,.ts"
          onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          className="block w-full flex-1 text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-4 file:py-2 file:text-sm file:font-bold hover:file:bg-muted sm:w-auto"
        />
        <button
          onClick={handleUpload}
          disabled={uploadingVideo || !videoFile}
          className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {uploadingVideo ? "جارٍ الرفع..." : "رفع الفيديو"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        الصيغ الشائعة: MP4 و MOV و WEBM و MKV و AVI و M4V و غيرها.
        ممكن ياخد دقايق على حسب حجم الملف وسرعة الإنترنت.
      </p>
    </section>
  );
}
