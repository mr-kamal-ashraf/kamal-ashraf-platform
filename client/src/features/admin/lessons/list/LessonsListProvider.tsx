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
import { adminLessonsApi, isApiError } from "@/api";
import type { BulkLessonAction } from "@/api/admin/lessons";
import type { Lesson, PaginatedResult, Stage } from "@/api/types";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import { useQueryFilters } from "@/shared/hooks/useQueryFilters";
import { readEnumParam, readTextParam } from "@/shared/lib/query";
import { STAGE_VALUES } from "@/shared/lib/stage";
import { useDebounced } from "@/shared/hooks/useDebounced";

/** "" = every lesson, "true" = published only, "false" = drafts only. */
export type PublishedFilter = "" | "true" | "false";

const PUBLISHED_VALUES = ["true", "false"] as const;

interface LessonsFilters extends Record<string, string> {
  search: string;
  stage: "" | Stage;
  published: PublishedFilter;
}

interface LessonsListContextValue {
  search: string;
  stage: "" | Stage;
  published: PublishedFilter;
  data: PaginatedResult<Lesson> | null;
  isLoading: boolean;
  setStage: (v: "" | Stage) => void;
  setSearch: (v: string) => void;
  setPublished: (v: PublishedFilter) => void;
  refresh: () => Promise<void>;
  togglePublish: (lesson: Lesson) => Promise<void>;
  deleteLesson: (lesson: Lesson) => Promise<void>;
  selectedLessonIds: ReadonlySet<string>;
  selectedCount: number;
  isBulkSubmitting: boolean;
  isLessonSelected: (lessonId: string) => boolean;
  toggleLessonSelection: (lessonId: string) => void;
  toggleVisibleLessons: () => void;
  clearSelection: () => void;
  runBulkAction: (action: BulkLessonAction) => Promise<void>;
}

const LessonsListContext = createContext<LessonsListContextValue | undefined>(
  undefined,
);

/**
 * Owns the lesson list's filters. They are seeded from the query string so the
 * dashboard's "منشور" / "مسودة" cards can link straight into the matching view,
 * and written back so the URL always reflects what is on screen.
 */
export function LessonsListProvider({ children }: { children: ReactNode }) {
  const confirm = useConfirm();

  const { filters, setFilter } = useQueryFilters<LessonsFilters>((params) => ({
    search: readTextParam(params.get("search")) ?? "",
    stage: readEnumParam(params.get("stage"), STAGE_VALUES) ?? "",
    published: readEnumParam(params.get("published"), PUBLISHED_VALUES) ?? "",
  }));

  const { search, stage, published } = filters;
  const [data, setData] = useState<PaginatedResult<Lesson> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const debouncedSearch = useDebounced(search, 300);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await adminLessonsApi.list({
        search: debouncedSearch || undefined,
        stage: stage || undefined,
        isPublished: published === "" ? undefined : published === "true",
        limit: 50,
      });
      setData(result);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, stage, published]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const togglePublish = useCallback(
    async (lesson: Lesson) => {
      try {
        await adminLessonsApi.togglePublish(lesson._id, !lesson.isPublished);
        toast.success(lesson.isPublished ? "تم الإخفاء" : "تم النشر");
        await refresh();
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      }
    },
    [refresh],
  );

  const deleteLesson = useCallback(
    async (lesson: Lesson) => {
      if (
        !(await confirm({
          title: "حذف الدرس",
          message: `متأكد من حذف "${lesson.title}"؟`,
          confirmLabel: "حذف",
          tone: "danger",
        }))
      )
        return;
      try {
        await adminLessonsApi.delete(lesson._id);
        toast.success("تم الحذف");
        await refresh();
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      }
    },
    [refresh, confirm],
  );

  const toggleLessonSelection = useCallback((lessonId: string) => {
    setSelectedLessonIds((current) => {
      const next = new Set(current);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  }, []);

  const visibleLessonIds = useMemo(
    () => data?.items.map((lesson) => lesson._id) ?? [],
    [data],
  );
  const allVisibleSelected =
    visibleLessonIds.length > 0 &&
    visibleLessonIds.every((lessonId) => selectedLessonIds.has(lessonId));
  const toggleVisibleLessons = useCallback(() => {
    if (visibleLessonIds.length === 0) return;
    setSelectedLessonIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleLessonIds.forEach((lessonId) => next.delete(lessonId));
      else visibleLessonIds.forEach((lessonId) => next.add(lessonId));
      return next;
    });
  }, [allVisibleSelected, visibleLessonIds]);
  const clearSelection = useCallback(() => setSelectedLessonIds(new Set()), []);

  const runBulkAction = useCallback(
    async (action: BulkLessonAction) => {
      if (isBulkSubmitting || selectedLessonIds.size === 0) return;
      const count = selectedLessonIds.size;
      const labels = {
        publish: { title: "نشر دروس متعددة", message: `هتنشر ${count} درس وهيوصل إشعار للطلاب المشتركين في الكورس. كل درس لازم يكون عليه فيديو. متأكد؟`, confirmLabel: "نشر الدروس", tone: "default" as const, done: "تم نشر" },
        unpublish: { title: "إخفاء دروس متعددة", message: `هتخفي ${count} درس من الطلاب. متأكد؟`, confirmLabel: "إخفاء الدروس", tone: "danger" as const, done: "تم إخفاء" },
        delete: { title: "حذف دروس نهائيًا", message: `هتحذف ${count} درس وفيديوهاته نهائيًا. لا يمكن التراجع عن الإجراء. متأكد؟`, confirmLabel: "حذف نهائي", tone: "danger" as const, done: "تم حذف" },
      }[action];
      if (!(await confirm(labels))) return;

      setIsBulkSubmitting(true);
      try {
        const result = await adminLessonsApi.bulkAction(action, [...selectedLessonIds]);
        clearSelection();
        toast.success(`${labels.done} ${result.processed} درس`);
        if (result.missingIds.length || result.failedIds.length) {
          toast.error(`${result.missingIds.length + result.failedIds.length} درس لم يكتمل الإجراء عليه`);
        }
        await refresh();
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ أثناء تنفيذ الإجراء");
      } finally {
        setIsBulkSubmitting(false);
      }
    },
    [clearSelection, confirm, isBulkSubmitting, refresh, selectedLessonIds],
  );

  const value = useMemo<LessonsListContextValue>(
    () => ({
      search,
      stage,
      published,
      data,
      isLoading,
      setStage: (v) => setFilter("stage", v),
      setSearch: (v) => setFilter("search", v),
      setPublished: (v) => setFilter("published", v),
      refresh,
      togglePublish,
      deleteLesson,
      selectedLessonIds,
      selectedCount: selectedLessonIds.size,
      isBulkSubmitting,
      isLessonSelected: (lessonId) => selectedLessonIds.has(lessonId),
      toggleLessonSelection,
      toggleVisibleLessons,
      clearSelection,
      runBulkAction,
    }),
    [
      search,
      stage,
      published,
      data,
      isLoading,
      refresh,
      togglePublish,
      deleteLesson,
      selectedLessonIds,
      isBulkSubmitting,
      toggleLessonSelection,
      toggleVisibleLessons,
      clearSelection,
      runBulkAction,
      setFilter,
    ],
  );

  return (
    <LessonsListContext.Provider value={value}>
      {children}
    </LessonsListContext.Provider>
  );
}

export function useLessonsList() {
  const ctx = useContext(LessonsListContext);
  if (!ctx)
    throw new Error("useLessonsList must be used within LessonsListProvider");
  return ctx;
}
