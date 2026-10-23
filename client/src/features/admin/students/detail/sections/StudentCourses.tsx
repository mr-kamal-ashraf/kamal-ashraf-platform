"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { STAGE_LABELS } from "@/shared/lib/stage";
import type { EnrollmentRecord, EnrollmentSource } from "@/api/types";
import { useStudentDetail } from "../StudentDetailProvider";

const SOURCE_LABELS: Record<EnrollmentSource, string> = {
  paymob: "دفع أونلاين",
  cash: "دفع كاش (يدوي)",
  code: "اتفتح بكود",
};

function courseOf(e: EnrollmentRecord) {
  return typeof e.courseId === "object" && e.courseId ? e.courseId : null;
}

export function StudentCourses() {
  const { data, courses, submitting, grantCourse, revokeCourse } =
    useStudentDetail();
  const [courseId, setCourseId] = useState("");
  const [notes, setNotes] = useState("");

  const activeEnrollments = useMemo(
    () => (data?.enrollments ?? []).filter((e) => e.status === "active"),
    [data?.enrollments],
  );

  const ownedIds = useMemo(
    () => new Set(activeEnrollments.map((e) => courseOf(e)?._id).filter(Boolean)),
    [activeEnrollments],
  );

  // Only offer courses the student doesn't already own.
  const grantableCourses = useMemo(
    () => courses.filter((c) => !ownedIds.has(c._id)),
    [courses, ownedIds],
  );

  if (!data) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <h2 className="text-base font-extrabold text-foreground sm:text-lg">
        كورسات الطالب
      </h2>

      {/* Owned courses */}
      {activeEnrollments.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {activeEnrollments.map((e) => {
            const c = courseOf(e);
            return (
              <li
                key={e._id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">
                    {c?.title ?? "كورس"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {c ? STAGE_LABELS[c.stage] : ""} ·{" "}
                    {SOURCE_LABELS[e.source]} ·{" "}
                    {e.amountPaid > 0 ? `${e.amountPaid} ج.م` : "مجاني"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => c && revokeCourse(c._id)}
                  disabled={submitting}
                  className="min-h-[36px] rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-500/25 disabled:opacity-50"
                >
                  سحب الوصول
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-500/5 p-3 text-sm text-amber-700">
          الطالب لسه مش مشترك في أي كورس.
        </p>
      )}

      {/* Manual (cash) grant */}
      <div className="mt-4 space-y-3 rounded-xl border border-border bg-background p-3 sm:p-4">
        <p className="text-sm font-bold text-foreground">
          فتح كورس يدوي (دفع كاش)
        </p>
        <p className="text-[11px] text-muted-foreground">
          استخدمه لما الطالب يدفع لك كاش بره المنصة. هيتسجّل بسعر الكورس.
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">اختر الكورس...</option>
            {grantableCourses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title} — {STAGE_LABELS[c.stage]} —{" "}
                {c.price > 0 ? `${c.price} ج.م` : "مجاني"}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات (اختياري)"
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={submitting || !courseId}
            onClick={async () => {
              if (!courseId) {
                toast.error("اختر كورس الأول");
                return;
              }
              await grantCourse(courseId, notes);
              setCourseId("");
              setNotes("");
            }}
            className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            فتح الكورس
          </button>
        </div>
      </div>
    </section>
  );
}
