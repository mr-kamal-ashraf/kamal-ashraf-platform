"use client";

import { FloatingInput } from "@/shared/ui/FloatingInput";
import { useProfile } from "../ProfileProvider";

export function ProfileChangePassword() {
  const {
    passwords,
    setCurrent,
    setNext,
    setConfirm,
    submitting,
    changePassword,
  } = useProfile();

  return (
    <section className="rounded-3xl border border-border bg-card p-8 shadow-soft">
      <h2 className="text-xl font-extrabold">تغيير كلمة السر</h2>
      <form onSubmit={changePassword} className="mt-6 space-y-6">
        <FloatingInput
          label="كلمة السر الحالية"
          type="password"
          required
          value={passwords.current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
        <FloatingInput
          label="كلمة السر الجديدة"
          type="password"
          required
          value={passwords.next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
        <FloatingInput
          label="تأكيد كلمة السر"
          type="password"
          required
          value={passwords.confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary"
        >
          {submitting ? "جاري الحفظ..." : "تغيير"}
        </button>
      </form>
    </section>
  );
}
