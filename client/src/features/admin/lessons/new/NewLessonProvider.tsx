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
import { adminLessonsApi, adminCoursesApi, isApiError } from "@/api";
import type { CourseAdminItem } from "@/api/types";
import {
  SLUG_TAKEN_MESSAGE,
  contentRules,
  focusFirstInvalid,
  hasErrors,
  serverFieldErrors,
  useLiveRecheck,
  type FieldErrors,
} from "@/features/admin/shared/wizardValidation";

export interface NewLessonForm {
  courseId: string;
  title: string;
  slug: string;
  description: string;
  longDescription: string;
  durationMinutes: number;
  chapters: number;
  topics: string[];
}

type UploadStep = "form" | "uploading" | "done";

/** Ordered wizard steps for the create-lesson flow. */
const WIZARD_STEPS = [
  { title: "الكورس والعنوان" },
  { title: "وصف الدرس" },
  { title: "الفيديو" },
  { title: "الصورة" },
] as const;

const TOTAL_STEPS = WIZARD_STEPS.length;

interface NewLessonContextValue {
  form: NewLessonForm;
  courses: CourseAdminItem[];
  thumbnailFile: File | null;
  videoFile: File | null;
  step: UploadStep;
  statusMessage: string;
  submitting: boolean;
  wizardStep: number;
  steps: readonly { title: string }[];
  isLastStep: boolean;
  /** This step's problems, shown under their fields after "التالي". */
  errors: FieldErrors;
  /** Asking the server whether the link is free. */
  checking: boolean;
  formRef: RefObject<HTMLFormElement | null>;
  setForm: (updater: (prev: NewLessonForm) => NewLessonForm) => void;
  setThumbnailFile: (f: File | null) => void;
  setVideoFile: (f: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  next: () => Promise<void>;
  prev: () => void;
}

const NewLessonContext = createContext<NewLessonContextValue | undefined>(
  undefined,
);

const initialForm: NewLessonForm = {
  courseId: "",
  title: "",
  slug: "",
  description: "",
  longDescription: "",
  durationMinutes: 30,
  chapters: 1,
  topics: [],
};

/** What each step checks: the form's fields, plus the video file. */
type CheckedField = keyof NewLessonForm | "video";

const STEP_FIELDS: CheckedField[][] = [
  ["courseId", "title", "slug"],
  ["description", "longDescription", "durationMinutes", "chapters", "topics"],
  ["video"],
  [],
];

/** The server's rules for one field (lesson.validation.ts). */
function checkField(
  field: CheckedField,
  form: NewLessonForm,
  videoFile: File | null,
): string | null {
  switch (field) {
    case "courseId":
      return form.courseId ? null : "اختار الكورس اللي الدرس هيتضاف ليه.";
    case "title":
      return contentRules.title(form.title, "الدرس");
    case "slug":
      return contentRules.slug(form.slug);
    case "description":
      return contentRules.description(form.description);
    case "longDescription":
      return contentRules.longDescription(form.longDescription);
    case "durationMinutes":
      return contentRules.durationMinutes(form.durationMinutes);
    case "chapters":
      return contentRules.chapters(form.chapters);
    case "topics":
      return contentRules.topics(form.topics);
    case "video":
      return videoFile ? null : "اختار ملف الفيديو عشان تكمّل.";
  }
}

function validateStep(step: number, form: NewLessonForm, videoFile: File | null): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of STEP_FIELDS[step] ?? []) {
    const message = checkField(field, form, videoFile);
    if (message) errors[field] = message;
  }
  return errors;
}

/** The step a field lives on — where a server error sends the teacher back to. */
const stepOf = (field: string) =>
  STEP_FIELDS.findIndex((fields) => (fields as string[]).includes(field));

export function NewLessonProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [form, setForm] = useState<NewLessonForm>(initialForm);
  const [courses, setCourses] = useState<CourseAdminItem[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<UploadStep>("form");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [wizardStep, setWizardStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [checking, setChecking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const checked = useMemo(() => ({ ...form, video: videoFile }), [form, videoFile]);
  useLiveRecheck(checked, setErrors, (field) => checkField(field, form, videoFile));

  // Load the course list and preselect the ?courseId= from the URL (set when
  // the admin clicked "درس جديد" from inside a course), else the first course.
  useEffect(() => {
    (async () => {
      try {
        const result = await adminCoursesApi.list({ limit: 100 });
        setCourses(result.items);
        const params = new URLSearchParams(window.location.search);
        const fromUrl = params.get("courseId") || "";
        const valid = result.items.some((c) => c._id === fromUrl);
        const preselect = valid ? fromUrl : result.items[0]?._id || "";
        setForm((p) => ({ ...p, courseId: preselect }));
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "فشل تحميل الكورسات");
      }
    })();
  }, []);

  /** Moves on only when this step is right — including a link no other lesson uses. */
  const next = useCallback(async () => {
    if (checking) return;
    const found = validateStep(wizardStep, form, videoFile);
    if (wizardStep === 0 && !found.slug) {
      setChecking(true);
      try {
        const { available } = await adminLessonsApi.slugAvailable(form.slug.trim());
        if (!available) found.slug = SLUG_TAKEN_MESSAGE;
      } catch {
        // Couldn't ask right now — saving checks it again anyway.
      } finally {
        setChecking(false);
      }
    }
    if (hasErrors(found)) {
      setErrors(found);
      toast.error("فيه خانات محتاجة تتصلّح — بصّ على اللي باللون الأحمر.");
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});
    setWizardStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, [checking, wizardStep, form, videoFile]);

  const prev = useCallback(() => {
    if (wizardStep === 0) {
      router.back();
      return;
    }
    setWizardStep((s) => Math.max(s - 1, 0));
  }, [wizardStep, router]);

  const submitFinal = useCallback(async () => {
    if (submitting) return;
    if (!form.courseId) {
      toast.error("لازم تختار الكورس اللي الدرس هيتضاف ليه");
      return;
    }
    if (!videoFile) {
      toast.error("لازم تختار ملف فيديو قبل حفظ الدرس");
      return;
    }
    setSubmitting(true);
    try {
      setStep("uploading");
      setStatusMessage("جارٍ إنشاء الدرس...");

      const result = await adminLessonsApi.create({
        courseId: form.courseId,
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        longDescription: form.longDescription.trim(),
        durationMinutes: form.durationMinutes,
        chapters: form.chapters,
        topics: form.topics.map((t) => t.trim()).filter(Boolean),
      });

      const lessonId = String(result.lesson._id ?? "");
      if (!lessonId) {
        throw new Error("MISSING_LESSON_ID");
      }

      if (thumbnailFile) {
        setStatusMessage("جارٍ رفع صورة الدرس...");
        try {
          await adminLessonsApi.uploadThumbnail(lessonId, thumbnailFile);
        } catch (err) {
          toast.warning(
            isApiError(err)
              ? `تم إنشاء الدرس لكن فشل رفع الصورة: ${err.message}`
              : "تم إنشاء الدرس. ارفع الصورة لاحقاً من صفحة التعديل.",
          );
        }
      }

      setStatusMessage("جارٍ رفع الفيديو");
      try {
        await adminLessonsApi.uploadVideo(lessonId, videoFile);
      } catch (err) {
        setStep("form");
        toast.error(
          isApiError(err)
            ? `تم إنشاء الدرس لكن فشل رفع الفيديو: ${err.message}. هنوجّهك لصفحة التعديل عشان ترفعه من هناك.`
            : "تم إنشاء الدرس لكن فشل رفع الفيديو. هنوجّهك لصفحة التعديل عشان ترفعه من هناك.",
        );
        router.push(`/admin/lessons/${lessonId}`);
        return;
      }

      setStep("done");
      toast.success("تم إنشاء الدرس بنجاح");
      router.push(`/admin/courses/${form.courseId}`);
    } catch (err) {
      setStep("form");
      // Something only the server knows (e.g. the link got taken meanwhile):
      // back to that field's step, with the message under it.
      const fieldErrors = serverFieldErrors(err);
      if (fieldErrors) {
        const back = Math.min(
          ...Object.keys(fieldErrors).map((f) => (stepOf(f) >= 0 ? stepOf(f) : TOTAL_STEPS - 1)),
        );
        setErrors(fieldErrors);
        setWizardStep(back);
        toast.error("فيه خانة محتاجة تتصلّح — رجّعناك للخطوة بتاعتها.");
        focusFirstInvalid(formRef.current, 320);
      } else {
        toast.error(isApiError(err) ? err.message : "حصل خطأ غير متوقع");
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, thumbnailFile, videoFile, submitting, router]);

  const isLastStep = wizardStep === TOTAL_STEPS - 1;

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      if (isLastStep) void submitFinal();
      else void next();
    },
    [submitting, isLastStep, submitFinal, next],
  );

  const value = useMemo<NewLessonContextValue>(
    () => ({
      form,
      courses,
      thumbnailFile,
      videoFile,
      step,
      statusMessage,
      submitting,
      wizardStep,
      steps: WIZARD_STEPS,
      isLastStep,
      errors,
      checking,
      formRef,
      setForm,
      setThumbnailFile,
      setVideoFile,
      onSubmit,
      next,
      prev,
    }),
    [
      form,
      courses,
      thumbnailFile,
      videoFile,
      step,
      statusMessage,
      submitting,
      wizardStep,
      isLastStep,
      errors,
      checking,
      onSubmit,
      next,
      prev,
    ],
  );

  return (
    <NewLessonContext.Provider value={value}>
      {children}
    </NewLessonContext.Provider>
  );
}

export function useNewLesson() {
  const ctx = useContext(NewLessonContext);
  if (!ctx) throw new Error("useNewLesson must be used within NewLessonProvider");
  return ctx;
}
