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
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminCoursesApi, adminLessonsApi, isApiError } from "@/api";
import type { CourseAdminItem, Lesson, LessonVideoStatus } from "@/api/types";
import {
  focusFirstInvalid,
  hasErrors,
  serverFieldErrors,
  useLiveRecheck,
  type FieldErrors,
} from "@/features/admin/shared/formValidation";
import {
  useUploadProgress,
  type UploadProgress,
} from "@/features/admin/shared/upload/useUploadProgress";
import {
  EMPTY_LESSON,
  checkLessonField,
  lessonPayload,
  validateLesson,
  type LessonFormValues,
} from "../components/LessonFields";
import { useVideoFileSeconds } from "../components/LessonVideoPicker";
import { useVideoWatch, withVideoStatus } from "../videoReadiness";

/** After the upload: publish by itself once the video is ready, or keep it hidden. */
export type PublishChoice = "whenReady" | "draft";

type Phase = "form" | "saving" | "done";

interface NewLessonContextValue {
  courses: CourseAdminItem[] | null;
  courseId: string;
  /** The course came with the link (from its page): shown, not asked. */
  courseFromLink: boolean;
  setCourseId: (id: string) => void;
  values: LessonFormValues;
  change: (patch: Partial<LessonFormValues>) => void;
  videoFile: File | null;
  setVideoFile: (file: File | null) => void;
  /** The picked video's length, read on this device. */
  videoSeconds: number | null;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  publishChoice: PublishChoice;
  setPublishChoice: (choice: PublishChoice) => void;
  errors: FieldErrors;
  phase: Phase;
  upload: UploadProgress | null;
  /** The lesson just saved (the "done" screen), kept up to date. */
  saved: Lesson | null;
  videoProgress: number | null;
  formRef: RefObject<HTMLFormElement | null>;
  submit: (e: React.FormEvent) => void;
  cancelUpload: () => void;
  /** Same course, fresh form — for the next lesson. */
  startNext: () => void;
}

const NewLessonContext = createContext<NewLessonContextValue | undefined>(undefined);

export function NewLessonProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseAdminItem[] | null>(null);
  const [courseId, setCourseIdState] = useState("");
  const [courseFromLink, setCourseFromLink] = useState(false);
  const [values, setValues] = useState<LessonFormValues>(EMPTY_LESSON);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [publishChoice, setPublishChoice] = useState<PublishChoice>("whenReady");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [saved, setSaved] = useState<Lesson | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { progress: upload, start, onProgress, reset } = useUploadProgress();
  const videoSeconds = useVideoFileSeconds(videoFile);

  const checked = useMemo(
    () => ({ ...values, courseId, video: videoFile }),
    [values, courseId, videoFile],
  );
  useLiveRecheck(checked, setErrors, (field) => {
    if (field === "courseId") return courseId ? null : "اختار الكورس اللي الدرس هيتضاف ليه.";
    if (field === "video") return videoFile ? null : "اختار فيديو الدرس.";
    return checkLessonField(field, values);
  });

  // The course from the link (the course page's "+ درس جديد"); otherwise the
  // teacher picks one — preselected only when there's just one.
  useEffect(() => {
    (async () => {
      try {
        const { items } = await adminCoursesApi.list({ limit: 100 });
        setCourses(items);
        const fromLink = new URLSearchParams(window.location.search).get("courseId") ?? "";
        if (items.some((c) => c._id === fromLink)) {
          setCourseIdState(fromLink);
          setCourseFromLink(true);
        } else if (items.length === 1) {
          setCourseIdState(items[0]._id);
        }
      } catch (err) {
        setCourses([]);
        toast.error(isApiError(err) ? err.message : "مقدرناش نجيب الكورسات");
      }
    })();
  }, []);

  const change = useCallback(
    (patch: Partial<LessonFormValues>) => setValues((v) => ({ ...v, ...patch })),
    [],
  );
  const setCourseId = useCallback((id: string) => setCourseIdState(id), []);

  const onSavedVideo = useCallback(
    (_id: string, video: LessonVideoStatus) =>
      setSaved((s) => (s ? withVideoStatus(s, video) : s)),
    [],
  );
  const watchProgress = useVideoWatch(saved ? [saved] : [], onSavedVideo);

  const save = useCallback(async () => {
    const found = validateLesson(values);
    if (!courseId) found.courseId = "اختار الكورس اللي الدرس هيتضاف ليه.";
    if (!videoFile) found.video = "اختار فيديو الدرس.";
    if (hasErrors(found)) {
      setErrors(found);
      toast.error("فيه خانات محتاجة تتصلّح — بصّ على اللي باللون الأحمر.");
      focusFirstInvalid(formRef.current);
      return;
    }
    if (!videoFile) return;

    setPhase("saving");
    start();
    let lesson: Lesson;
    try {
      ({ lesson } = await adminLessonsApi.create({
        courseId,
        ...lessonPayload(values, videoSeconds),
      }));
    } catch (err) {
      setPhase("form");
      reset();
      const fieldErrors = serverFieldErrors(err);
      if (fieldErrors) {
        setErrors(fieldErrors);
        focusFirstInvalid(formRef.current, 50);
      }
      toast.error(isApiError(err) ? err.message : "حصل خطأ غير متوقع");
      return;
    }

    if (imageFile) {
      try {
        ({ lesson } = await adminLessonsApi.uploadThumbnail(lesson._id, imageFile));
      } catch (err) {
        toast.warning(
          `الدرس اتحفظ، بس الصورة ماترفعتش${isApiError(err) ? `: ${err.message}` : ""} — ارفعها من صفحة الدرس.`,
        );
      }
    }

    const abort = new AbortController();
    abortRef.current = abort;
    try {
      ({ lesson } = await adminLessonsApi.uploadVideo(lesson._id, videoFile, {
        onProgress,
        signal: abort.signal,
      }));
    } catch (err) {
      // The lesson exists without its video: its page has the upload box.
      const cancelled = isApiError(err) && err.code === "REQUEST_ABORTED";
      toast[cancelled ? "info" : "error"](
        cancelled
          ? "وقّفنا رفع الفيديو. الدرس اتحفظ من غير فيديو — ارفعه من هنا وقت ما تحب."
          : `الدرس اتحفظ بس الفيديو ماترفعش${isApiError(err) ? `: ${err.message}` : ""} — جرّب ترفعه تاني من هنا.`,
      );
      router.push(`/admin/lessons/${lesson._id}`);
      return;
    } finally {
      abortRef.current = null;
    }

    if (publishChoice === "whenReady") {
      try {
        ({ lesson } = await adminLessonsApi.togglePublish(lesson._id, true, { whenReady: true }));
      } catch (err) {
        toast.warning(
          `الدرس اترفع، بس مقدرناش نظبط النشر${isApiError(err) ? `: ${err.message}` : ""} — انشره من صفحة الكورس.`,
        );
      }
    }

    setSaved(lesson);
    setPhase("done");
    reset();
    window.scrollTo({ top: 0 });
  }, [values, courseId, videoFile, videoSeconds, imageFile, publishChoice, start, onProgress, reset, router]);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (phase === "form") void save();
    },
    [phase, save],
  );

  const cancelUpload = useCallback(() => abortRef.current?.abort(), []);

  const startNext = useCallback(() => {
    setValues(EMPTY_LESSON);
    setVideoFile(null);
    setImageFile(null);
    setErrors({});
    setSaved(null);
    setPhase("form");
    window.scrollTo({ top: 0 });
    // The course's lesson count moved on (where the next one goes).
    adminCoursesApi
      .list({ limit: 100 })
      .then(({ items }) => setCourses(items))
      .catch(() => undefined);
  }, []);

  const value = useMemo<NewLessonContextValue>(
    () => ({
      courses,
      courseId,
      courseFromLink,
      setCourseId,
      values,
      change,
      videoFile,
      setVideoFile,
      videoSeconds,
      imageFile,
      setImageFile,
      publishChoice,
      setPublishChoice,
      errors,
      phase,
      upload,
      saved,
      videoProgress: saved ? (watchProgress[saved._id] ?? null) : null,
      formRef,
      submit,
      cancelUpload,
      startNext,
    }),
    [
      courses,
      courseId,
      courseFromLink,
      setCourseId,
      values,
      change,
      videoFile,
      videoSeconds,
      imageFile,
      publishChoice,
      errors,
      phase,
      upload,
      saved,
      watchProgress,
      submit,
      cancelUpload,
      startNext,
    ],
  );

  return <NewLessonContext.Provider value={value}>{children}</NewLessonContext.Provider>;
}

export function useNewLesson() {
  const ctx = useContext(NewLessonContext);
  if (!ctx) throw new Error("useNewLesson must be used within NewLessonProvider");
  return ctx;
}
