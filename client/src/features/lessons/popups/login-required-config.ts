export type LoginRequiredReason =
  | "guest"
  | "stage-mismatch"
  | "no-video"
  | "generic-error";

export interface LoginRequiredConfig {
  title: string;
  description: string;
  cta: { label: string; href: string };
}

export const LOGIN_REQUIRED_REASON_CONFIG: Record<
  LoginRequiredReason,
  LoginRequiredConfig
> = {
  guest: {
    title: "لازم تسجل دخول الأول",
    description:
      "محتاج تسجل دخول بحسابك علشان تقدر تشاهد الدرس. لو معندكش حساب اعمل واحد دلوقتي.",
    cta: { label: "تسجيل دخول", href: "/login" },
  },
  "stage-mismatch": {
    title: "الدرس مش لمرحلتك",
    description: "الدرس ده مش لمرحلتك الدراسية، شوف الدروس المخصصة لك.",
    cta: { label: "شوف دروس مرحلتك", href: "/" },
  },
  "no-video": {
    title: "الفيديو لسه مش متاح",
    description:
      "الدرس موجود لكن الأستاذ لسه ما رفعش الفيديو. حاول تاني بعد شوية أو تواصل مع الأستاذ.",
    cta: { label: "العودة للدروس", href: "/" },
  },
  "generic-error": {
    title: "حصل خطأ",
    description: "في مشكلة في تحميل الدرس دلوقتي. حاول تاني بعد شوية.",
    cta: { label: "العودة للرئيسية", href: "/" },
  },
};
