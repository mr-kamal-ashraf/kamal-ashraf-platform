"use client";

import { useStudentDetail } from "../StudentDetailProvider";

export function StudentSessions() {
  const { data, revokeSession } = useStudentDetail();
  if (!data) return null;
  const { activeSessions } = data;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <h2 className="text-base font-extrabold text-foreground sm:text-lg">
        الجلسات النشطة
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        الأجهزة اللي الطالب مسجل دخول عليها حالياً
      </p>
      {activeSessions.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">مفيش جلسات نشطة</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {activeSessions.map((session) => (
            <li
              key={session._id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">
                  {session.deviceLabel}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                  IP: {session.ipAddress || "—"} • آخر نشاط:{" "}
                  {new Date(session.lastActiveAt).toLocaleString("ar-EG")}
                </div>
              </div>
              <button
                onClick={() => revokeSession(session._id)}
                className="min-h-[40px] shrink-0 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-500/25"
              >
                إنهاء
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
