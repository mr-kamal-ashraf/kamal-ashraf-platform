"use client";

import { motion } from "framer-motion";
import { FloatingInput } from "@/shared/ui/FloatingInput";
import { useAdminLogin } from "../AdminLoginProvider";

export function AdminLoginCard() {
  const {
    email,
    password,
    showPwd,
    loading,
    setEmail,
    setPassword,
    toggleShowPwd,
    submit,
  } = useAdminLogin();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md rounded-3xl border border-border bg-card/80 p-8 shadow-elegant backdrop-blur-xl"
    >
      <div className="mb-8 text-center" dir="rtl">
        <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-brand shadow-brand">
          <svg
            className="size-7 text-primary-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-foreground">
          لوحة تحكم الأدمن
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          للأستاذ فقط — استخدم بياناتك الخاصة
        </p>
      </div>

      <form onSubmit={submit} className="space-y-7" dir="rtl">
        <FloatingInput
          label="البريد الإلكتروني"
          type="email"
          required
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <FloatingInput
          label="كلمة السر"
          type={showPwd ? "text" : "password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          trailing={
            <button
              type="button"
              onClick={toggleShowPwd}
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              {showPwd ? "إخفاء" : "إظهار"}
            </button>
          }
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-gradient-brand py-3.5 text-base font-bold text-primary-foreground shadow-brand transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        أي محاولة دخول هنا مسجلة. الوصول للأدمن فقط.
      </p>
    </motion.div>
  );
}
