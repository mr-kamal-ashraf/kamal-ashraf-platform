"use client";

import { useState } from "react";
import { useStudentDetail } from "../StudentDetailProvider";

export function StudentResetPassword() {
  const { submitting, resetPassword } = useStudentDetail();
  const [newPassword, setNewPassword] = useState("");

  const handleSubmit = async () => {
    await resetPassword(newPassword);
    setNewPassword("");
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <h2 className="text-base font-extrabold text-foreground sm:text-lg">
        إعادة تعيين كلمة السر
      </h2>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          placeholder="كلمة السر الجديدة"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="min-h-[44px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || newPassword.length < 6}
          className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          تعيين
        </button>
      </div>
    </section>
  );
}
