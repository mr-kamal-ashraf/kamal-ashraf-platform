import type { Metadata } from "next";
import { LoginView } from "@/features/auth/login/LoginView";
import { SITE } from "@/shared/i18n/site";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
  description: `ادخل على حسابك في ${SITE.brand} وكمّل كورساتك في الأحياء والجيولوجيا.`,
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return <LoginView />;
}
