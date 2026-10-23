"use client";

import { useStudentDetail } from "../StudentDetailProvider";

/**
 * Destructive account actions, kept visually separate (red danger zone) at the
 * bottom of the student page so they're not clicked by accident. The delete
 * itself goes through the shared confirm popup before anything happens.
 */
export function StudentDangerZone() {
  const { submitting, deleteStudent } = useStudentDetail();

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 shadow-soft sm:p-6">
      <h2 className="text-base font-extrabold text-destructive sm:text-lg">
        منطقة الخطر
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
        حذف الطالب بيمسح حسابه وكل بياناته (الكورسات، التقدّم، الجلسات)
        نهائيًا — مفيش تراجع بعد الحذف. المدفوعات بتتحفظ كسجل مالي.
      </p>
      <button
        type="button"
        onClick={deleteStudent}
        disabled={submitting}
        className="mt-4 min-h-[44px] rounded-lg border-2 border-destructive/40 bg-destructive px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        حذف الطالب نهائيًا
      </button>
    </section>
  );
}
