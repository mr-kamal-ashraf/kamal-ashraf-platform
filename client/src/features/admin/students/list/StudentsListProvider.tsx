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
import { adminStudentsApi, isApiError } from "@/api";
import type { BulkStudentAction } from "@/api/admin/students";
import type { PaginatedResult, Stage, User } from "@/api/types";
import { useDebounced } from "@/shared/hooks/useDebounced";
import { useQueryFilters } from "@/shared/hooks/useQueryFilters";
import { readEnumParam, readTextParam } from "@/shared/lib/query";
import { STAGE_VALUES } from "@/shared/lib/stage";
import {
  STUDENT_STATUS_VALUES,
  type StudentStatusFilter,
} from "../config/status-labels";
import {
  COMMITMENT_VALUES,
  type CommitmentFilter,
} from "../config/commitment-labels";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";

interface StudentsFilters extends Record<string, string> {
  search: string;
  stage: "" | Stage;
  status: StudentStatusFilter;
  commitment: CommitmentFilter;
}

interface StudentsListContextValue {
  search: string;
  stage: "" | Stage;
  status: StudentStatusFilter;
  commitment: CommitmentFilter;
  page: number;
  data: PaginatedResult<User> | null;
  isLoading: boolean;
  error: string | null;
  setSearch: (v: string) => void;
  setStage: (v: "" | Stage) => void;
  setStatus: (v: StudentStatusFilter) => void;
  setCommitment: (v: CommitmentFilter) => void;
  setPage: (v: number) => void;
  selectedStudentIds: ReadonlySet<string>;
  selectedCount: number;
  isBulkSubmitting: boolean;
  isStudentSelected: (studentId: string) => boolean;
  toggleStudentSelection: (studentId: string) => void;
  toggleVisibleStudents: () => void;
  clearSelection: () => void;
  runBulkAction: (action: BulkStudentAction) => Promise<void>;
}

const StudentsListContext = createContext<StudentsListContextValue | undefined>(
  undefined,
);

/**
 * Owns the student list. Filters live in the query string (see useQueryFilters)
 * so a dashboard card can link straight into a filtered view and the teacher
 * can bookmark the views they use often.
 */
export function StudentsListProvider({ children }: { children: ReactNode }) {
  const confirm = useConfirm();
  const { filters, setFilter } = useQueryFilters<StudentsFilters>((params) => ({
    search: readTextParam(params.get("search")) ?? "",
    stage: readEnumParam(params.get("stage"), STAGE_VALUES) ?? "",
    status: readEnumParam(params.get("status"), STUDENT_STATUS_VALUES) ?? "",
    commitment:
      readEnumParam(params.get("commitment"), COMMITMENT_VALUES) ?? "",
  }));

  const { search, stage, status, commitment } = filters;

  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResult<User> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  const debouncedSearch = useDebounced(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stage, status, commitment]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const result = await adminStudentsApi.list({
          search: debouncedSearch || undefined,
          stage: stage || undefined,
          status: status || undefined,
          commitment: commitment || undefined,
          page,
          limit: 20,
        });
        if (!cancelled) {
          setData(result);
          setError(null);
        }
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
  }, [debouncedSearch, stage, status, commitment, page, reloadVersion]);

  const toggleStudentSelection = useCallback((studentId: string) => {
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }, []);

  const visibleStudentIds = useMemo(
    () => data?.items.map((student) => student._id) ?? [],
    [data],
  );
  const allVisibleSelected =
    visibleStudentIds.length > 0 &&
    visibleStudentIds.every((studentId) => selectedStudentIds.has(studentId));

  const toggleVisibleStudents = useCallback(() => {
    if (visibleStudentIds.length === 0) return;
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleStudentIds.forEach((studentId) => next.delete(studentId));
      } else {
        visibleStudentIds.forEach((studentId) => next.add(studentId));
      }
      return next;
    });
  }, [allVisibleSelected, visibleStudentIds]);

  const clearSelection = useCallback(() => {
    setSelectedStudentIds(new Set());
  }, []);

  const runBulkAction = useCallback(
    async (action: BulkStudentAction) => {
      if (isBulkSubmitting || selectedStudentIds.size === 0) return;

      const count = selectedStudentIds.size;
      const labels = {
        suspend: {
          title: "تعليق حسابات متعددة",
          message: `هتعلّق ${count} طالب وتُنهي جلساتهم على كل الأجهزة. متأكد؟`,
          confirmLabel: "تعليق الحسابات",
          tone: "danger" as const,
          done: "تم تعليق",
        },
        unsuspend: {
          title: "إعادة تفعيل حسابات متعددة",
          message: `هتعيد تفعيل ${count} طالب. متأكد؟`,
          confirmLabel: "إعادة التفعيل",
          tone: "default" as const,
          done: "تمت إعادة تفعيل",
        },
        delete: {
          title: "حذف طلاب نهائيًا",
          message: `هتحذف ${count} طالب وكل بياناتهم نهائيًا، ولا يمكن التراجع عن الإجراء. المدفوعات ستظل محفوظة كسجل مالي. متأكد؟`,
          confirmLabel: "حذف نهائي",
          tone: "danger" as const,
          done: "تم حذف",
        },
      }[action];

      const approved = await confirm({
        title: labels.title,
        message: labels.message,
        confirmLabel: labels.confirmLabel,
        tone: labels.tone,
      });
      if (!approved) return;

      setIsBulkSubmitting(true);
      try {
        const result = await adminStudentsApi.bulkAction(action, [
          ...selectedStudentIds,
        ]);
        clearSelection();
        toast.success(`${labels.done} ${result.processed} طالب`);
        if (result.missingIds.length || result.failedIds.length) {
          toast.error(
            `${result.missingIds.length + result.failedIds.length} طالب لم يكتمل الإجراء عليه`,
          );
        }
        if (page === 1) setReloadVersion((version) => version + 1);
        else setPage(1);
      } catch (err) {
        toast.error(
          isApiError(err) ? err.message : "حصل خطأ أثناء تنفيذ الإجراء",
        );
      } finally {
        setIsBulkSubmitting(false);
      }
    },
    [
      clearSelection,
      confirm,
      isBulkSubmitting,
      page,
      selectedStudentIds,
      setPage,
    ],
  );

  const value = useMemo<StudentsListContextValue>(
    () => ({
      search,
      stage,
      status,
      commitment,
      page,
      data,
      isLoading,
      error,
      setSearch: (v) => setFilter("search", v),
      setStage: (v) => setFilter("stage", v),
      setStatus: (v) => setFilter("status", v),
      setCommitment: (v) => setFilter("commitment", v),
      setPage,
      selectedStudentIds,
      selectedCount: selectedStudentIds.size,
      isBulkSubmitting,
      isStudentSelected: (studentId) => selectedStudentIds.has(studentId),
      toggleStudentSelection,
      toggleVisibleStudents,
      clearSelection,
      runBulkAction,
    }),
    [
      search,
      stage,
      status,
      commitment,
      page,
      data,
      isLoading,
      error,
      setFilter,
      selectedStudentIds,
      isBulkSubmitting,
      toggleStudentSelection,
      toggleVisibleStudents,
      clearSelection,
      runBulkAction,
    ],
  );

  return (
    <StudentsListContext.Provider value={value}>
      {children}
    </StudentsListContext.Provider>
  );
}

export function useStudentsList() {
  const ctx = useContext(StudentsListContext);
  if (!ctx)
    throw new Error("useStudentsList must be used within StudentsListProvider");
  return ctx;
}
