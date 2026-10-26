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
import type { Lesson, LessonVideoStatus, PaginatedResult, Stage } from "@/api/types";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import { useQueryFilters } from "@/shared/hooks/useQueryFilters";
import { readEnumParam, readTextParam } from "@/shared/lib/query";
import { STAGE_VALUES } from "@/shared/lib/stage";
import { useDebounced } from "@/shared/hooks/useDebounced";
import { useVideoWatch, withVideoStatus } from "../videoReadiness";

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
  /** The lesson as the server now has it (after publish / hide). */
  replaceLesson: (lesson: Lesson) => void;
  /** How far each video being prepared is (0–100), when known. */
  videoProgress: Record<string, number | null>;
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

  const replaceLesson = useCallback(
    (updated: Lesson) =>
      setData((prev) =>
        prev && { ...prev, items: prev.items.map((l) => (l._id === updated._id ? updated : l)) },
      ),
    [],
  );

  // A video finished being prepared (or broke, or the lesson went live by
  // itself) while the list was open — one watcher for the whole list.
  const updateLessonVideo = useCallback(
    (lessonId: string, video: LessonVideoStatus) =>
      setData((prev) =>
        prev && {
          ...prev,
          items: prev.items.map((l) => (l._id === lessonId ? withVideoStatus(l, video) : l)),
        },
      ),
    [],
  );
  const videoProgress = useVideoWatch(data?.items ?? [], updateLessonVideo);

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
        publish: { title: "نشر دروس متعددة", message: `هتنشر ${count} درس وهيوصل إشعار للطلاب المشتركين في الكورس. اللي الفيديو بتاعه لسه بيتجهز هيتنشر لوحده أول ما يخلص، واللي من غير فيديو مش هيتنشر. متأكد؟`, confirmLabel: "نشر الدروس", tone: "default" as const, done: "تم نشر" },
        unpublish: { title: "إخفاء دروس متعددة", message: `هتخفي ${count} درس من الطلاب. متأكد؟`, confirmLabel: "إخفاء الدروس", tone: "danger" as const, done: "تم إخفاء" },
        delete: { title: "حذف دروس نهائيًا", message: `هتحذف ${count} درس وفيديوهاته نهائيًا. لا يمكن التراجع عن الإجراء. متأكد؟`, confirmLabel: "حذف نهائي", tone: "danger" as const, done: "تم حذف" },
      }[action];
      if (!(await confirm(labels))) return;

      setIsBulkSubmitting(true);
      try {
        const result = await adminLessonsApi.bulkAction(action, [...selectedLessonIds]);
        clearSelection();
        const scheduled = result.scheduledIds?.length ?? 0;
        const done = result.processed - scheduled;
        if (done > 0) toast.success(`${labels.done} ${done} درس`);
        if (scheduled > 0) toast.success(`${scheduled} درس هيتنشروا لوحدهم أول ما الفيديو يجهز`);
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
      replaceLesson,
      videoProgress,
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
      replaceLesson,
      videoProgress,
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
