"use client";

import Link from "next/link";
import { BackLink } from "@/features/admin/shared/BackLink";
import { ImagePicker, useObjectUrl } from "@/features/admin/shared/form/ImagePicker";
import { MoreDetails } from "@/features/admin/shared/form/MoreDetails";
import { Panel } from "@/features/admin/shared/form/Panel";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/features/admin/shared/form/styles";
import { UploadProgressScreen } from "@/features/admin/shared/upload/UploadProgressScreen";
import { LessonEssentials, LessonExtras } from "../components/LessonFields";
import { LessonVideoPicker } from "../components/LessonVideoPicker";
import { NewLessonProvider, useNewLesson } from "./NewLessonProvider";
import { NewLessonCourse } from "./sections/NewLessonCourse";
import { NewLessonDone } from "./sections/NewLessonDone";
import { NewLessonPublishChoice } from "./sections/NewLessonPublishChoice";

/**
 * A new lesson on one page: the video, its name and a line about it — the
 * rest is optional and folded away. Saving uploads the video with its
 * progress shown, and can publish the lesson by itself once it's ready.
 */
function NewLessonContent() {
  const {
    courseId,
    courseFromLink,
    values,
    change,
    videoFile,
    setVideoFile,
    videoSeconds,
    imageFile,
    setImageFile,
    errors,
    phase,
    upload,
    formRef,
    submit,
    cancelUpload,
  } = useNewLesson();
  const imageUrl = useObjectUrl(imageFile);
  const back = courseFromLink && courseId ? `/admin/courses/${courseId}` : "/admin/lessons";

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <div>
        <BackLink href={back}>{courseFromLink ? "صفحة الكورس" : "الدروس"}</BackLink>
        <h1 className="mt-1 text-xl font-extrabold text-foreground sm:text-2xl">درس جديد</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          اختار الفيديو واكتب اسم الدرس — وده كل اللي لازم.
        </p>
      </div>

      {phase === "done" ? (
        <NewLessonDone />
      ) : (
        <form ref={formRef} noValidate onSubmit={submit} className="space-y-5 sm:space-y-6">
          <NewLessonCourse />

          <Panel title="فيديو الدرس">
            <div data-invalid={errors.video ? "true" : undefined}>
              <LessonVideoPicker
                file={videoFile}
                onFile={setVideoFile}
                onClear={() => setVideoFile(null)}
                invalid={!!errors.video}
              />
              {errors.video && (
                <p role="alert" className="mt-1.5 text-xs font-semibold text-destructive">
                  {errors.video}
                </p>
              )}
            </div>
          </Panel>

          <Panel title="اسم الدرس ووصفه">
            <LessonEssentials values={values} onChange={change} errors={errors} />
          </Panel>

          <MoreDetails
            title="تفاصيل إضافية"
            hint="وصف أطول، محاور الدرس، المدة، عدد الفصول، وصورة للدرس."
          >
            <LessonExtras
              values={values}
              onChange={change}
              errors={errors}
              videoSeconds={videoSeconds}
            />
            <div>
              <span className="mb-1.5 block text-xs font-bold text-foreground">صورة الدرس</span>
              <ImagePicker
                imageUrl={imageUrl}
                onFile={setImageFile}
                onClear={() => setImageFile(null)}
              />
            </div>
          </MoreDetails>

          <NewLessonPublishChoice />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <Link href={back} className={SECONDARY_BUTTON_CLASS}>
              إلغاء
            </Link>
            <button type="submit" disabled={phase !== "form"} className={PRIMARY_BUTTON_CLASS}>
              احفظ الدرس وارفع الفيديو
            </button>
          </div>
        </form>
      )}

      {phase === "saving" && (
        <UploadProgressScreen
          title="بنرفع فيديو الدرس"
          savingTitle="بنحفظ الفيديو"
          progress={upload}
          onCancel={cancelUpload}
        />
      )}
    </div>
  );
}

export function NewLessonView() {
  return (
    <NewLessonProvider>
      <NewLessonContent />
    </NewLessonProvider>
  );
}
