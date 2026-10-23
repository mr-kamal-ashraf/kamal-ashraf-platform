"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { SITE } from "@/shared/i18n/site";
import { STAGE_LIST } from "@/shared/lib/stage";
import { FloatingInput } from "@/shared/ui/FloatingInput";
import {
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  PhoneIcon,
  UsersIcon,
} from "../../components/auth-icons";
import { StepProgress } from "../components/StepProgress";
import { useRegister } from "../RegisterProvider";
import { BioBadge } from "@/shared/components/bio";
import { BtnNucleus } from "@/shared/ui/Button";

function ArrowBack() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}


export function RegisterFormSide() {
  const {
    form,
    stage,
    showPwd,
    showPwd2,
    loading,
    error,
    step,
    steps,
    isLastStep,
    resendSeconds,
    update,
    setStage,
    toggleShowPwd,
    toggleShowPwd2,
    next,
    back,
    resendCodes,
    onSubmit,
  } = useRegister();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-20"
    >
      <div className="w-full max-w-xl">
        <div className="mb-8 lg:hidden">
          <BioBadge>منصة {SITE.teacherName}</BioBadge>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          <span className="text-gradient-brand">إنشاء حساب جديد</span>
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          دقايق وحسابك جاهز، وتقدر تشتري كورساتك وتبدأ تذاكر على طول.
        </p>

        <form noValidate onSubmit={onSubmit} className="mt-10">
          <StepProgress step={step} steps={steps} />

          <div className="min-h-[210px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {step === 0 && (
                  <div className="grid grid-cols-1 gap-y-7">
                    <FloatingInput
                      label="الاسم الأول"
                      required
                      autoFocus
                      value={form.firstName}
                      onChange={update("firstName")}
                    />
                    <FloatingInput
                      label="اسم الأب"
                      required
                      value={form.secondName}
                      onChange={update("secondName")}
                    />
                    <FloatingInput
                      label="اسم الجد"
                      required
                      value={form.thirdName}
                      onChange={update("thirdName")}
                    />
                  </div>
                )}

                {step === 1 && (
                  <div className="grid grid-cols-1 gap-y-7">
                    <FloatingInput
                      label="رقم موبايل الطالب"
                      type="tel"
                      required
                      autoFocus
                      hint="01xxxxxxxxx"
                      dir="ltr"
                      icon={<PhoneIcon />}
                      value={form.studentPhone}
                      onChange={update("studentPhone")}
                    />
                    <FloatingInput
                      label="رقم موبايل ولي الأمر"
                      type="tel"
                      required
                      hint="01xxxxxxxxx"
                      dir="ltr"
                      icon={<UsersIcon />}
                      value={form.parentPhone}
                      onChange={update("parentPhone")}
                    />
                  </div>
                )}

                {step === 2 && (
                  <div className="grid grid-cols-1 gap-y-7">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                      أرسلنا كودًا مختلفًا لكل رقم على واتساب. اكتب كل كود في
                      المكان الصحيح لتأكيد الرقمين.
                    </div>
                    <FloatingInput
                      label="كود الطالب"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      autoFocus
                      hint="6 أرقام"
                      dir="ltr"
                      value={form.studentVerificationCode}
                      onChange={update("studentVerificationCode")}
                    />
                    <FloatingInput
                      label="كود ولي الأمر"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      hint="6 أرقام"
                      dir="ltr"
                      value={form.parentVerificationCode}
                      onChange={update("parentVerificationCode")}
                    />
                    <button
                      type="button"
                      onClick={() => void resendCodes()}
                      disabled={loading || resendSeconds > 0}
                      className="w-fit text-sm font-bold text-primary transition-colors hover:text-primary/75 disabled:cursor-not-allowed disabled:text-muted-foreground"
                    >
                      {resendSeconds > 0
                        ? `إعادة الإرسال بعد ${resendSeconds} ثانية`
                        : "إعادة إرسال الكودين"}
                    </button>
                  </div>
                )}

                {step === 3 && (
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {STAGE_LIST.map((s) => {
                      const selected = stage === s.key;
                      return (
                        <button
                          type="button"
                          key={s.key}
                          onClick={() => setStage(s.key)}
                          aria-pressed={selected}
                          className={`group relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border-2 px-2 py-4 text-xs font-bold transition-all sm:text-sm ${
                            selected
                              ? "border-primary bg-primary/10 text-primary shadow-soft"
                              : "border-border bg-card text-muted-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          <span
                            className="flex size-11 items-center justify-center rounded-full text-sm font-black text-white shadow-soft transition-transform group-hover:scale-105"
                            style={{ background: `var(${s.gradientVar})` }}
                          >
                            {s.shortLabel}
                          </span>
                          {s.label}
                          {selected && (
                            <span className="absolute left-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <svg
                                className="size-3"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {step === 4 && (
                  <div className="grid grid-cols-1 gap-y-7">
                    <FloatingInput
                      label="كلمة السر"
                      type={showPwd ? "text" : "password"}
                      required
                      autoFocus
                      hint="٨ حروف على الأقل"
                      icon={<LockIcon />}
                      value={form.password}
                      onChange={update("password")}
                      trailing={
                        <button
                          type="button"
                          onClick={toggleShowPwd}
                          aria-label={
                            showPwd ? "إخفاء كلمة السر" : "إظهار كلمة السر"
                          }
                          className="text-muted-foreground transition-colors hover:text-primary"
                        >
                          {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      }
                    />
                    <FloatingInput
                      label="تأكيد كلمة السر"
                      type={showPwd2 ? "text" : "password"}
                      required
                      hint="اكتب كلمة السر تاني"
                      icon={<LockIcon />}
                      value={form.confirmPassword}
                      onChange={update("confirmPassword")}
                      trailing={
                        <button
                          type="button"
                          onClick={toggleShowPwd2}
                          aria-label={
                            showPwd2 ? "إخفاء كلمة السر" : "إظهار كلمة السر"
                          }
                          className="text-muted-foreground transition-colors hover:text-primary"
                        >
                          {showPwd2 ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      }
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
            >
              {error}
            </div>
          )}

          <div className="mt-8 flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                disabled={loading}
                className="btn btn-secondary btn-lg"
              >
                <ArrowBack />
                السابق
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg flex-1"
            >
              <BtnNucleus />
              {isLastStep
                ? loading
                  ? "جارٍ التسجيل..."
                  : "إنشاء الحساب"
                : "التالي"}
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          عندك حساب بالفعل؟{" "}
          <Link
            href="/login"
            className="font-bold text-primary transition-colors hover:text-primary/80 hover:underline"
          >
            ادخل دلوقتي
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
