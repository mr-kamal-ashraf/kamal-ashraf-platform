"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminLessonsApi, adminCoursesApi, isApiError } from "@/api";
import type { CourseAdminItem, Lesson } from "@/api/types";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";

interface EditLessonContextValue {
  lessonId: string;
  lesson: Lesson | null;
  courses: CourseAdminItem[];
  isLoading: boolean;
  error: string | null;
  submitting: boolean;
  uploadingVideo: boolean;
  uploadingThumbnail: boolean;
  /** Bunny's conversion progress (0–100) while the video is still converting. */
  videoProgress: number | null;
  setLesson: (l: Lesson) => void;
  save: (e: React.FormEvent) => Promise<void>;
  uploadVideo: (file: File, onDone: () => void) => Promise<void>;
  uploadThumbnail: (file: File, onDone: () => void) => Promise<void>;
  clearThumbnail: () => Promise<void>;
  togglePublish: () => Promise<void>;
  deleteLesson: () => Promise<void>;
}

const EditLessonContext = createContext<EditLessonContextValue | undefined>(
  undefined,
);

/** How often the page asks whether Bunny has finished converting the video. */
const VIDEO_CHECK_EVERY_MS = 8000;

export function EditLessonProvider({
  lessonId,
  children,
}: {
  lessonId: string;
  children: ReactNode;
}) {
  const confirm = useConfirm();
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [courses, setCourses] = useState<CourseAdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await adminLessonsApi.get(lessonId);
        if (!cancelled) setLesson(result.lesson);
      } catch (err) {
        if (!cancelled) {
          setError(isApiError(err) ? err.message : "حصل خطأ");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await adminCoursesApi.list({ limit: 100 });
        if (!cancelled) setCourses(result.items);
      } catch {
        /* non-fatal — the course selector just stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // While Bunny is still converting the video, ask every few seconds (only on
  // this page, only while it's on screen) so the status — and the publish
  // button — update by themselves. Stops once the video is ready or failed.
  const videoPending =
    !!lesson?.bunnyVideoId &&
    lesson.videoStatus !== "ready" &&
    lesson.videoStatus !== "failed";
  useEffect(() => {
    if (!videoPending) return;
    let cancelled = false;
    let timer = 0;
    const check = async () => {
      if (document.visibilityState === "visible") {
        try {
          const video = await adminLessonsApi.videoStatus(lessonId);
          if (cancelled) return;
          setVideoProgress(video.encodeProgress);
          setLesson((prev) =>
            prev && {
              ...prev,
              videoStatus: video.videoStatus,
              videoDurationSeconds: video.videoDurationSeconds,
            },
          );
          if (video.videoStatus === "ready" || video.videoStatus === "failed") return;
        } catch {
          /* try again next round */
        }
      }
      if (!cancelled) timer = window.setTimeout(check, VIDEO_CHECK_EVERY_MS);
    };
    timer = window.setTimeout(check, VIDEO_CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [videoPending, lessonId]);

  const save = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!lesson || submitting) return;
      setSubmitting(true);
      try {
        const result = await adminLessonsApi.update(lessonId, {
          title: lesson.title,
          slug: lesson.slug,
          description: lesson.description,
          longDescription: lesson.longDescription,
          courseId: lesson.courseId,
          durationMinutes: lesson.durationMinutes,
          chapters: lesson.chapters,
          topics: lesson.topics.map((t) => t.trim()).filter(Boolean),
        });
        setLesson(result.lesson);
        toast.success("تم تحديث بيانات الدرس");
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      } finally {
        setSubmitting(false);
      }
    },
    [lesson, lessonId, submitting],
  );

  const uploadVideo = useCallback(
    async (file: File, onDone: () => void) => {
      setUploadingVideo(true);
      try {
        const result = await adminLessonsApi.uploadVideo(lessonId, file);
        setLesson(result.lesson);
        onDone();
        toast.success("تم رفع الفيديو بنجاح");
        router.push("/admin/lessons");
      } catch (err) {
        toast.error(
          isApiError(err)
            ? err.message
            : "حصل خطأ أثناء رفع الفيديو، حاول تاني.",
        );
      } finally {
        setUploadingVideo(false);
      }
    },
    [lessonId, router],
  );

  const uploadThumbnail = useCallback(
    async (file: File, onDone: () => void) => {
      setUploadingThumbnail(true);
      try {
        const result = await adminLessonsApi.uploadThumbnail(lessonId, file);
        setLesson(result.lesson);
        onDone();
        toast.success("تم رفع الصورة بنجاح");
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      } finally {
        setUploadingThumbnail(false);
      }
    },
    [lessonId],
  );

  const clearThumbnail = useCallback(async () => {
    if (
      !(await confirm({
        title: "حذف الصورة",
        message: "متأكد من حذف صورة الدرس؟",
        confirmLabel: "حذف",
        tone: "danger",
      }))
    )
      return;
    try {
      const result = await adminLessonsApi.clearThumbnail(lessonId);
      setLesson(result.lesson);
      toast.success("تم حذف الصورة");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }, [lessonId, confirm]);

  const togglePublish = useCallback(async () => {
    if (!lesson) return;
    try {
      const result = await adminLessonsApi.togglePublish(
        lessonId,
        !lesson.isPublished,
      );
      setLesson(result.lesson);
      toast.success(lesson.isPublished ? "تم الإخفاء" : "تم النشر");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }, [lesson, lessonId]);

  const deleteLesson = useCallback(async () => {
    if (
      !(await confirm({
        title: "حذف الدرس",
        message: "متأكد من حذف الدرس؟ هذا الإجراء لا يمكن التراجع عنه.",
        confirmLabel: "حذف",
        tone: "danger",
      }))
    )
      return;
    try {
      await adminLessonsApi.delete(lessonId);
      toast.success("تم حذف الدرس");
      router.push("/admin/lessons");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }, [lessonId, router, confirm]);

  const value = useMemo<EditLessonContextValue>(
    () => ({
      lessonId,
      lesson,
      courses,
      isLoading,
      error,
      submitting,
      uploadingVideo,
      uploadingThumbnail,
      videoProgress,
      setLesson,
      save,
      uploadVideo,
      uploadThumbnail,
      clearThumbnail,
      togglePublish,
      deleteLesson,
    }),
    [
      lessonId,
      lesson,
      courses,
      isLoading,
      error,
      submitting,
      uploadingVideo,
      uploadingThumbnail,
      videoProgress,
      save,
      uploadVideo,
      uploadThumbnail,
      clearThumbnail,
      togglePublish,
      deleteLesson,
    ],
  );

  return (
    <EditLessonContext.Provider value={value}>
      {children}
    </EditLessonContext.Provider>
  );
}

export function useEditLesson() {
  const ctx = useContext(EditLessonContext);
  if (!ctx)
    throw new Error("useEditLesson must be used within EditLessonProvider");
  return ctx;
}
