"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { SITE } from "@/shared/i18n/site";
import { SiteHeader } from "@/shared/components/SiteHeader";
import { BioBadge, PageBackdrop } from "@/shared/components/bio";
import { FloatingInput } from "@/shared/ui/FloatingInput";
import { BtnNucleus } from "@/shared/ui/Button";
import { AuthBrandPanel } from "../components/AuthBrandPanel";
import {
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  PhoneIcon,
} from "../components/auth-icons";
import { StepProgress } from "../register/components/StepProgress";
import { FORGOT_STEPS, useForgotPassword } from "./useForgotPassword";

export function ForgotPasswordView() {
  const f = useForgotPassword();
  const isLast = f.step === FORGOT_STEPS.length - 1;

  const eye = (
    <button
      type="button"
      onClick={f.toggleShowPwd}
      aria-label={f.showPwd ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
      className="text-muted-foreground transition-colors hover:text-primary"
    >
      {f.showPwd ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="relative flex-1">
        <PageBackdrop className="lg:hidden" />
        <div className="grid lg:grid-cols-2 lg:min-h-[calc(100vh-6rem)]">
          <AuthBrandPanel
            title="ولا يهمك!"
            subtitle="هنرجّعلك حسابك في دقيقة — هيوصلك كود على واتساب 🤍"
          />

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
                <span className="text-gradient-brand">نسيت كلمة السر؟</span>
              </h1>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                اكتب رقم موبايلك المسجل بيه، وهيوصلك كود على واتساب تغيّر بيه
                كلمة السر.
              </p>

              <form noValidate onSubmit={f.submit} className="mt-10">
                <StepProgress step={f.step} steps={FORGOT_STEPS} />

                <div className="min-h-40">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={f.step}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      {f.step === 0 && (
                        <FloatingInput
                          label="رقم موبايل الطالب"
                          type="tel"
                          required
                          autoFocus
                          hint="01xxxxxxxxx"
                          dir="ltr"
                          icon={<PhoneIcon />}
                          autoComplete="tel"
                          inputMode="tel"
                          value={f.phone}
                          onChange={f.setPhone}
                        />
                      )}

                      {f.step === 1 && (
                        <div className="grid grid-cols-1 gap-y-6">
                          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                            بعتنا كود من 6 أرقام على واتساب للرقم{" "}
                            <span
                              dir="ltr"
                              className="font-bold text-foreground"
                            >
                              {f.phone.trim()}
                            </span>
                          </div>
                          <FloatingInput
                            label="الكود"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            required
                            autoFocus
                            hint="6 أرقام"
                            dir="ltr"
                            value={f.code}
                            onChange={f.setCode}
                          />
                          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold">
                            <button
                              type="button"
                              onClick={() => void f.resend()}
                              disabled={f.loading || f.resendSeconds > 0}
                              className="text-primary transition-colors hover:text-primary/75 disabled:cursor-not-allowed disabled:text-muted-foreground"
                            >
                              {f.resendSeconds > 0
                                ? `إعادة الإرسال بعد ${f.resendSeconds} ثانية`
                                : "إعادة إرسال الكود"}
                            </button>
                            <button
                              type="button"
                              onClick={f.changePhone}
                              disabled={f.loading}
                              className="text-muted-foreground transition-colors hover:text-foreground"
                            >
                              تغيير الرقم
                            </button>
                          </div>
                        </div>
                      )}

                      {f.step === 2 && (
                        <div className="grid grid-cols-1 gap-y-7">
                          <FloatingInput
                            label="كلمة السر الجديدة"
                            type={f.showPwd ? "text" : "password"}
                            required
                            autoFocus
                            hint="٨ حروف على الأقل، فيها حرف إنجليزي ورقم"
                            icon={<LockIcon />}
                            autoComplete="new-password"
                            value={f.password}
                            onChange={f.setPassword}
                            trailing={eye}
                          />
                          <FloatingInput
                            label="تأكيد كلمة السر"
                            type={f.showPwd ? "text" : "password"}
                            required
                            hint="اكتب كلمة السر تاني"
                            icon={<LockIcon />}
                            autoComplete="new-password"
                            value={f.confirm}
                            onChange={f.setConfirm}
                          />
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {f.error && (
                  <div
                    role="alert"
                    className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
                  >
                    {f.error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={f.loading}
                  className="btn btn-primary btn-lg mt-8 w-full"
                >
                  <BtnNucleus />
                  {f.loading
                    ? "لحظة..."
                    : f.step === 0
                      ? "ابعتلي الكود"
                      : isLast
                        ? "غيّر كلمة السر"
                        : "التالي"}
                </button>
              </form>

              <p className="mt-8 text-center text-sm text-muted-foreground">
                افتكرت كلمة السر؟{" "}
                <Link
                  href="/login"
                  className="font-bold text-primary transition-colors hover:text-primary/80 hover:underline"
                >
                  ارجع لتسجيل الدخول
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
