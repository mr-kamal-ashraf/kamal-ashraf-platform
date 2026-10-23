"use client";

import { STAGE_LABELS } from "@/shared/lib/stage";
import { InfoRow } from "../components/InfoRow";
import { useStudentDetail } from "../StudentDetailProvider";

export function StudentHeader() {
  const { data, submitting, toggleSuspend } = useStudentDetail();
  if (!data) return null;
  const { user } = data;

  return (
    <header className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
            {user.firstName} {user.secondName} {user.thirdName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-bold text-primary">
              {STAGE_LABELS[user.stage]}
            </span>
            {user.isSuspended ? (
              <span className="rounded-full bg-red-500/10 px-2.5 py-1 font-bold text-red-600">
                معلق
              </span>
            ) : user.isActive ? (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-600">
                مفعل
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-bold text-amber-600">
                بانتظار التفعيل
              </span>
            )}
          </div>
        </div>
        <button
          onClick={toggleSuspend}
          disabled={submitting}
          className={`min-h-[44px] w-full rounded-xl px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 sm:w-auto ${
            user.isSuspended
              ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
              : "bg-red-500/15 text-red-700 hover:bg-red-500/25"
          }`}
        >
          {user.isSuspended ? "إلغاء التعليق" : "تعليق الحساب"}
        </button>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <InfoRow label="رقم الطالب" value={user.studentPhone} mono />
        <InfoRow label="رقم ولي الأمر" value={user.parentPhone} mono />
        <InfoRow
          label="آخر دخول"
          value={
            user.lastLoginAt
              ? new Date(user.lastLoginAt).toLocaleString("ar-EG")
              : "—"
          }
        />
      </dl>
    </header>
  );
}
