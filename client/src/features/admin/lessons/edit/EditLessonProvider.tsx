"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminLessonsApi, adminCoursesApi, isApiError } from "@/api";
import type { CourseAdminItem, Lesson, LessonVideoStatus } from "@/api/types";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import {
  useUploadProgress,
  type UploadProgress,
} from "@/features/admin/shared/upload/useUploadProgress";
import { useVideoWatch, withVideoStatus } from "../videoReadiness";

interface EditLessonContextValue {
  lessonId: string;
  lesson: Lesson | null;
  courses: CourseAdminItem[];
  isLoading: boolean;
  error: string | null;
  /** The video going up (null when no upload is running). */
  videoUpload: UploadProgress | null;
  uploadingThumbnail: boolean;
  /** How far the video service is (0–100) while it prepares the video. */
  videoProgress: number | null;
  /** The lesson as the server now has it (after a save, a publish…). */
  setLesson: (lesson: Lesson) => void;
  uploadVideo: (file: File) => Promise<void>;
  cancelVideoUpload: () => void;
  uploadThumbnail: (file: File) => Promise<void>;
  clearThumbnail: () => Promise<void>;
  deleteLesson: () => Promise<void>;
}

const EditLessonContext = createContext<EditLessonContextValue | undefined>(undefined);

export function EditLessonProvider({
  lessonId,
  children,
}: {
  lessonId: string;
  children: ReactNode;
}) {
  const confirm = useConfirm();
  const router = useRouter();
  const [lesson, setLessonState] = useState<Lesson | null>(null);
  const [courses, setCourses] = useState<CourseAdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const { progress: videoUpload, start, onProgress, reset } = useUploadProgress();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await adminLessonsApi.get(lessonId);
        if (!cancelled) setLessonState(result.lesson);
      } catch (err) {
        if (!cancelled) setError(isApiError(err) ? err.message : "حصل خطأ");
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

  const setLesson = useCallback((l: Lesson) => setLessonState(l), []);

  // While the video is still being prepared, its state — and the publish
  // button — update by themselves (see videoReadiness).
  const onVideo = useCallback(
    (_id: string, video: LessonVideoStatus) =>
      setLessonState((prev) => (prev ? withVideoStatus(prev, video) : prev)),
    [],
  );
  const watch = useVideoWatch(lesson ? [lesson] : [], onVideo);

  const uploadVideo = useCallback(
    async (file: File) => {
      const abort = new AbortController();
      abortRef.current = abort;
      start();
      try {
        const result = await adminLessonsApi.uploadVideo(lessonId, file, {
          onProgress,
          signal: abort.signal,
        });
        setLessonState(result.lesson);
        toast.success("الفيديو اترفع ✓ — بيتجهز دلوقتي وهتشوف حالته هنا.");
      } catch (err) {
        toast.error(
          isApiError(err) && err.code === "REQUEST_ABORTED"
            ? "وقّفنا رفع الفيديو — الفيديو القديم زي ما هو."
            : isApiError(err)
              ? err.message
              : "حصل خطأ أثناء رفع الفيديو، حاول تاني.",
        );
      } finally {
        abortRef.current = null;
        reset();
      }
    },
    [lessonId, start, onProgress, reset],
  );

  const cancelVideoUpload = useCallback(() => abortRef.current?.abort(), []);

  const uploadThumbnail = useCallback(
    async (file: File) => {
      setUploadingThumbnail(true);
      try {
        const result = await adminLessonsApi.uploadThumbnail(lessonId, file);
        setLessonState(result.lesson);
        toast.success("اتحفظت صورة الدرس ✓");
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      } finally {
        setUploadingThumbnail(false);
      }
    },
    [lessonId],
  );

  const clearThumbnail = useCallback(async () => {
    setUploadingThumbnail(true);
    try {
      const result = await adminLessonsApi.clearThumbnail(lessonId);
      setLessonState(result.lesson);
      toast.success("اتشالت صورة الدرس");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    } finally {
      setUploadingThumbnail(false);
    }
  }, [lessonId]);

  const deleteLesson = useCallback(async () => {
    if (
      !(await confirm({
        title: "حذف الدرس",
        message: `هيتحذف درس «${lesson?.title ?? ""}» والفيديو بتاعه. مفيش تراجع بعد كده.`,
        confirmLabel: "حذف الدرس",
        tone: "danger",
      }))
    )
      return;
    try {
      await adminLessonsApi.delete(lessonId);
      toast.success("الدرس اتحذف");
      router.push(lesson ? `/admin/courses/${lesson.courseId}` : "/admin/lessons");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }, [lessonId, lesson, router, confirm]);

  const value = useMemo<EditLessonContextValue>(
    () => ({
      lessonId,
      lesson,
      courses,
      isLoading,
      error,
      videoUpload,
      uploadingThumbnail,
      videoProgress: watch[lessonId] ?? null,
      setLesson,
      uploadVideo,
      cancelVideoUpload,
      uploadThumbnail,
      clearThumbnail,
      deleteLesson,
    }),
    [
      lessonId,
      lesson,
      courses,
      isLoading,
      error,
      videoUpload,
      uploadingThumbnail,
      watch,
      setLesson,
      uploadVideo,
      cancelVideoUpload,
      uploadThumbnail,
      clearThumbnail,
      deleteLesson,
    ],
  );

  return <EditLessonContext.Provider value={value}>{children}</EditLessonContext.Provider>;
}

export function useEditLesson() {
  const ctx = useContext(EditLessonContext);
  if (!ctx) throw new Error("useEditLesson must be used within EditLessonProvider");
  return ctx;
}
