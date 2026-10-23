"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SITE } from "@/shared/i18n/site";
import { FloatingInput } from "@/shared/ui/FloatingInput";
import {
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  PhoneIcon,
} from "../../components/auth-icons";
import { useLogin } from "../LoginProvider";
import { BioBadge } from "@/shared/components/bio";
import { BtnNucleus } from "@/shared/ui/Button";

export function LoginFormSide() {
  const {
    studentPhone,
    password,
    showPwd,
    loading,
    setStudentPhone,
    setPassword,
    toggleShowPwd,
    submit,
  } = useLogin();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-16 lg:py-20"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 lg:hidden">
          <BioBadge>منصة {SITE.teacherName}</BioBadge>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          <span className="text-gradient-brand">تسجيل الدخول</span>
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          ادخل على حسابك بإدخال رقم الهاتف وكلمة المرور المسجل بهم من قبل.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-7">
          <FloatingInput
            label="رقم الهاتف"
            type="tel"
            required
            hint="01xxxxxxxxx"
            dir="ltr"
            icon={<PhoneIcon />}
            value={studentPhone}
            onChange={(e) => setStudentPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            pattern="01[0-25][0-9]{8}"
          />

          <div>
            <FloatingInput
              label="كلمة السر"
              type={showPwd ? "text" : "password"}
              required
              icon={<LockIcon />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              trailing={
                <button
                  type="button"
                  onClick={toggleShowPwd}
                  aria-label={showPwd ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />
            <div className="mt-2 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-bold text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                نسيت كلمة السر؟
              </Link>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border-border accent-primary focus:ring-primary/30"
            />
            فكّرني على الجهاز ده
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg w-full"
          >
            <BtnNucleus />
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          لسه ماعندكش حساب؟{" "}
          <Link
            href="/register"
            className="font-bold text-primary transition-colors hover:text-primary/80 hover:underline"
          >
            سجّل دلوقتي
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
