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
import { toast } from "sonner";
import {
  aiApi,
  isApiError,
  type CurriculumBook,
  type ExamQuestionType,
  type GeneratedExam,
  type GenerateExamRequest,
} from "@/api";
import { DEFAULT_EXAM_FORM } from "./config";

interface ExamGeneratorContextValue {
  form: GenerateExamRequest;
  exam: GeneratedExam | null;
  /** The teacher's uploaded curriculum books — the source the exam draws from. */
  books: CurriculumBook[];
  booksLoading: boolean;
  /** The teacher's saved papers (library), newest first. */
  savedExams: GeneratedExam[];
  savedLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  /** True once every required field is filled — drives the submit button. */
  canGenerate: boolean;
  setField: <K extends keyof GenerateExamRequest>(
    key: K,
    value: GenerateExamRequest[K],
  ) => void;
  toggleQuestionType: (type: ExamQuestionType) => void;
  /** Add/remove a book from the multi-select source list. */
  toggleBook: (bookId: string) => void;
  generate: () => Promise<void>;
  /** Show a saved paper in the result pane. */
  openSavedExam: (exam: GeneratedExam) => void;
  /** Delete a saved paper from the library (and clear it if it's on screen). */
  deleteSavedExam: (id: string) => Promise<void>;
  reset: () => void;
}

const ExamGeneratorContext = createContext<ExamGeneratorContextValue | undefined>(
  undefined,
);

/**
 * Owns the exam form, the paper on screen, and the teacher's saved library.
 *
 * Papers are now PERSISTED server-side: every generated paper is saved and the
 * library survives a refresh. The teacher can re-open, print, or delete any of
 * them. The platform never keeps an answer key — papers are questions-only.
 */
export function ExamGeneratorProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<GenerateExamRequest>(DEFAULT_EXAM_FORM);
  const [exam, setExam] = useState<GeneratedExam | null>(null);
  const [books, setBooks] = useState<CurriculumBook[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [savedExams, setSavedExams] = useState<GeneratedExam[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the teacher's uploaded curriculum so the form can offer it as the
  // source to generate from. A failure here is non-fatal: the picker just
  // falls back to "all of this stage's books".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await aiApi.listCurriculum();
        if (!cancelled) setBooks(res.items);
      } catch {
        if (!cancelled) setBooks([]);
      } finally {
        if (!cancelled) setBooksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the saved library so it's there on first paint and after a refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await aiApi.listExams();
        if (!cancelled) setSavedExams(res.items);
      } catch {
        if (!cancelled) setSavedExams([]);
      } finally {
        if (!cancelled) setSavedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = useCallback(
    <K extends keyof GenerateExamRequest>(
      key: K,
      value: GenerateExamRequest[K],
    ) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleQuestionType = useCallback((type: ExamQuestionType) => {
    setForm((prev) => {
      const selected = prev.questionTypes.includes(type)
        ? prev.questionTypes.filter((item) => item !== type)
        : [...prev.questionTypes, type];
      // Never allow an empty selection — the paper needs at least one shape.
      return selected.length === 0 ? prev : { ...prev, questionTypes: selected };
    });
  }, []);

  const toggleBook = useCallback((bookId: string) => {
    setForm((prev) => {
      const selected = prev.bookIds.includes(bookId)
        ? prev.bookIds.filter((id) => id !== bookId)
        : [...prev.bookIds, bookId];
      return { ...prev, bookIds: selected };
    });
  }, []);

  // Bring the generated/opened paper into view (it lives in the result pane).
  const scrollToResult = useCallback(() => {
    if (typeof document === "undefined") return;
    window.setTimeout(() => {
      document
        .getElementById("exam-result")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, []);

  const canGenerate =
    form.topics.trim().length >= 3 && form.questionTypes.length > 0;

  const generate = useCallback(async () => {
    if (!canGenerate || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await aiApi.generateExam({
        ...form,
        topics: form.topics.trim(),
        notes: form.notes?.trim() || undefined,
      });
      setExam(result.exam);
      // Prepend to the library so the new paper shows up immediately.
      setSavedExams((prev) => [result.exam, ...prev]);
      scrollToResult();
      toast.success("تم توليد الامتحان وحفظه");
    } catch (err) {
      const message = isApiError(err) ? err.message : "حصل خطأ، جرّب تاني";
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [form, canGenerate, isGenerating, scrollToResult]);

  const openSavedExam = useCallback(
    (saved: GeneratedExam) => {
      setExam(saved);
      setError(null);
      scrollToResult();
    },
    [scrollToResult],
  );

  const deleteSavedExam = useCallback(async (id: string) => {
    try {
      await aiApi.deleteExam(id);
      setSavedExams((prev) => prev.filter((item) => item.id !== id));
      setExam((current) => (current && current.id === id ? null : current));
      toast.success("تم حذف الامتحان");
    } catch (err) {
      const message = isApiError(err) ? err.message : "مقدرناش نحذف الامتحان";
      toast.error(message);
    }
  }, []);

  const reset = useCallback(() => {
    setExam(null);
    setError(null);
  }, []);

  const value = useMemo<ExamGeneratorContextValue>(
    () => ({
      form,
      exam,
      books,
      booksLoading,
      savedExams,
      savedLoading,
      isGenerating,
      error,
      canGenerate,
      setField,
      toggleQuestionType,
      toggleBook,
      generate,
      openSavedExam,
      deleteSavedExam,
      reset,
    }),
    [
      form,
      exam,
      books,
      booksLoading,
      savedExams,
      savedLoading,
      isGenerating,
      error,
      canGenerate,
      setField,
      toggleQuestionType,
      toggleBook,
      generate,
      openSavedExam,
      deleteSavedExam,
      reset,
    ],
  );

  return (
    <ExamGeneratorContext.Provider value={value}>
      {children}
    </ExamGeneratorContext.Provider>
  );
}

export function useExamGenerator() {
  const ctx = useContext(ExamGeneratorContext);
  if (!ctx) {
    throw new Error(
      "useExamGenerator must be used within ExamGeneratorProvider",
    );
  }
  return ctx;
}
