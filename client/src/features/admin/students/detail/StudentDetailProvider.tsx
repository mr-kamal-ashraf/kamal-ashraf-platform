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
import { adminStudentsApi, adminCoursesApi, isApiError } from "@/api";
import type { CourseAdminItem, StudentDetail } from "@/api/types";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";

interface StudentDetailContextValue {
  studentId: string;
  data: StudentDetail | null;
  courses: CourseAdminItem[];
  isLoading: boolean;
  error: string | null;
  submitting: boolean;
  refresh: () => Promise<void>;
  grantCourse: (courseId: string, notes: string) => Promise<void>;
  revokeCourse: (courseId: string) => Promise<void>;
  toggleSuspend: () => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  revokeSession: (sessionId: string) => Promise<void>;
  deleteStudent: () => Promise<void>;
}

const StudentDetailContext = createContext<StudentDetailContextValue | undefined>(
  undefined,
);

export function StudentDetailProvider({
  studentId,
  children,
}: {
  studentId: string;
  children: ReactNode;
}) {
  const confirm = useConfirm();
  const router = useRouter();
  const [data, setData] = useState<StudentDetail | null>(null);
  const [courses, setCourses] = useState<CourseAdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await adminStudentsApi.get(studentId);
      setData(result);
      setError(null);
    } catch (err) {
      setError(isApiError(err) ? err.message : "حصل خطأ");
    }
  }, [studentId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const [detail, courseList] = await Promise.all([
          adminStudentsApi.get(studentId),
          adminCoursesApi.list({ limit: 100 }),
        ]);
        if (!cancelled) {
          setData(detail);
          setCourses(courseList.items);
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
  }, [studentId]);

  const grantCourse = useCallback(
    async (courseId: string, notes: string) => {
      if (submitting || !courseId) return;
      setSubmitting(true);
      try {
        await adminStudentsApi.grantCourse(studentId, courseId, notes || undefined);
        toast.success("تم فتح الكورس للطالب");
        await refresh();
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      } finally {
        setSubmitting(false);
      }
    },
    [studentId, submitting, refresh],
  );

  const revokeCourse = useCallback(
    async (courseId: string) => {
      if (submitting) return;
      if (
        !(await confirm({
          title: "سحب الكورس",
          message: "متأكد من سحب الكورس من الطالب؟",
          confirmLabel: "سحب",
          tone: "danger",
        }))
      )
        return;
      setSubmitting(true);
      try {
        await adminStudentsApi.revokeCourse(studentId, courseId);
        toast.success("تم سحب الكورس");
        await refresh();
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      } finally {
        setSubmitting(false);
      }
    },
    [studentId, submitting, refresh, confirm],
  );

  const toggleSuspend = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (data?.user.isSuspended) {
        await adminStudentsApi.unsuspend(studentId);
        toast.success("تم إعادة تفعيل الحساب");
      } else {
        if (
          !(await confirm({
            title: "تعليق الحساب",
            message:
              "متأكد من تعليق الحساب؟ هيتم تسجيل خروج الطالب من كل الأجهزة",
            confirmLabel: "تعليق",
            tone: "danger",
          }))
        ) {
          setSubmitting(false);
          return;
        }
        await adminStudentsApi.suspend(studentId);
        toast.success("تم تعليق الحساب");
      }
      await refresh();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    } finally {
      setSubmitting(false);
    }
  }, [studentId, submitting, data?.user.isSuspended, refresh, confirm]);

  const resetPassword = useCallback(
    async (newPassword: string) => {
      if (submitting || newPassword.length < 6) {
        toast.error("كلمة السر لازم 6 حروف على الأقل");
        return;
      }
      setSubmitting(true);
      try {
        await adminStudentsApi.resetPassword(studentId, newPassword);
        toast.success("تم تغيير كلمة السر");
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      } finally {
        setSubmitting(false);
      }
    },
    [studentId, submitting],
  );

  const revokeSession = useCallback(
    async (sessionId: string) => {
      if (
        !(await confirm({
          title: "إنهاء الجلسة",
          message: "متأكد من إنهاء الجلسة دي؟",
          confirmLabel: "إنهاء",
          tone: "danger",
        }))
      )
        return;
      try {
        await adminStudentsApi.revokeSession(studentId, sessionId);
        toast.success("تم إنهاء الجلسة");
        await refresh();
      } catch (err) {
        toast.error(isApiError(err) ? err.message : "حصل خطأ");
      }
    },
    [studentId, refresh, confirm],
  );

  const deleteStudent = useCallback(async () => {
    if (submitting) return;
    const studentName = data
      ? `${data.user.firstName} ${data.user.secondName} ${data.user.thirdName}`.trim()
      : "الطالب";
    if (
      !(await confirm({
        title: "حذف الطالب نهائيًا",
        message: `هتحذف ${studentName} وكل بياناته (الكورسات، التقدّم، الجلسات) نهائيًا. المدفوعات هتتحفظ. الإجراء ده مش هينفع يترجع. متأكد؟`,
        confirmLabel: "حذف نهائي",
        cancelLabel: "إلغاء",
        tone: "danger",
      }))
    )
      return;
    setSubmitting(true);
    try {
      await adminStudentsApi.deleteStudent(studentId);
      toast.success("تم حذف الطالب وكل بياناته نهائيًا");
      router.push("/admin/students");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ أثناء الحذف");
      setSubmitting(false);
    }
  }, [studentId, submitting, data, confirm, router]);

  const value = useMemo<StudentDetailContextValue>(
    () => ({
      studentId,
      data,
      courses,
      isLoading,
      error,
      submitting,
      refresh,
      grantCourse,
      revokeCourse,
      toggleSuspend,
      resetPassword,
      revokeSession,
      deleteStudent,
    }),
    [
      studentId,
      data,
      courses,
      isLoading,
      error,
      submitting,
      refresh,
      grantCourse,
      revokeCourse,
      toggleSuspend,
      resetPassword,
      revokeSession,
      deleteStudent,
    ],
  );

  return (
    <StudentDetailContext.Provider value={value}>
      {children}
    </StudentDetailContext.Provider>
  );
}

export function useStudentDetail() {
  const ctx = useContext(StudentDetailContext);
  if (!ctx)
    throw new Error("useStudentDetail must be used within StudentDetailProvider");
  return ctx;
}
