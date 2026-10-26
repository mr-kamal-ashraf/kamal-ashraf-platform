"use client";

import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import { Panel } from "@/features/admin/shared/form/Panel";
import { UploadProgressScreen } from "@/features/admin/shared/upload/UploadProgressScreen";
import { LessonVideoPicker, formatVideoLength } from "../../components/LessonVideoPicker";
import { isVideoPending } from "../../videoReadiness";
import { useEditLesson } from "../EditLessonProvider";

/** The lesson's video: where it stands, and a drop box to upload or replace it. */
export function EditLessonVideo() {
  const { lesson, videoUpload, videoProgress, uploadVideo, cancelVideoUpload } = useEditLesson();
  const confirm = useConfirm();
  if (!lesson) return null;

  async function pick(file: File) {
    if (
      lesson?.bunnyVideoId &&
      !(await confirm({
        title: "تغيير الفيديو",
        message: lesson.isPublished
          ? "الفيديو الحالي هيتشال والجديد هيتحط مكانه. الدرس منشور، فالطلاب مش هيقدروا يشغّلوه كام دقيقة لحد ما الفيديو الجديد يجهز."
          : "الفيديو الحالي هيتشال والجديد هيتحط مكانه.",
        confirmLabel: "ارفع الجديد",
      }))
    )
      return;
    await uploadVideo(file);
  }

  return (
    <Panel title="فيديو الدرس">
      {videoUpload && (
        <UploadProgressScreen
          title="بنرفع فيديو الدرس"
          savingTitle="بنحفظ الفيديو"
          progress={videoUpload}
          onCancel={cancelVideoUpload}
        />
      )}

      {!lesson.bunnyVideoId ? (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700">
          الدرس لسه من غير فيديو — ارفعه هنا، وبعدها تقدر تنشره.
        </p>
      ) : lesson.videoStatus === "failed" ? (
        <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700">
          الفيديو ده فيه مشكلة ومش هيشتغل للطلاب — ارفعه تاني.
        </p>
      ) : isVideoPending(lesson) ? (
        <div role="status" className="space-y-2 rounded-xl bg-sky-500/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-300">
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-600"
            />
            الفيديو اترفع وبيتجهز دلوقتي
            {videoProgress ? <bdi>({videoProgress}%)</bdi> : "..."}
          </p>
          <p className="text-xs text-muted-foreground">
            {lesson.publishWhenReady
              ? "أول ما يخلص، الدرس هيتنشر للطلاب لوحده."
              : "بياخد عادةً كام دقيقة — الصفحة بتتحدث لوحدها."}
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700">
          ✓ الفيديو جاهز
          {lesson.videoDurationSeconds > 0 && (
            <span className="ms-2 font-semibold text-muted-foreground">
              — مدته {formatVideoLength(lesson.videoDurationSeconds)}
            </span>
          )}
        </p>
      )}

      <LessonVideoPicker
        file={null}
        onFile={pick}
        title={lesson.bunnyVideoId ? "عايز تغيّر الفيديو؟ اسحب الجديد هنا أو اختاره" : undefined}
      />
    </Panel>
  );
}
