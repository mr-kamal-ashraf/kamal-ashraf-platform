"use client";

import { useProfile } from "../ProfileProvider";

export function ProfileLogout() {
  const { logoutAndGoHome } = useProfile();

  return (
    <section className="rounded-3xl border border-border bg-card p-8 shadow-soft">
      <h2 className="text-xl font-extrabold">الخروج</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        ممكن تسجل خروج من الجهاز ده.
      </p>
      <button
        onClick={logoutAndGoHome}
        className="btn btn-danger mt-4"
      >
        تسجيل خروج
      </button>
    </section>
  );
}
