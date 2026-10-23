import type { Metadata } from "next";
import { RegisterView } from "@/features/auth/register/RegisterView";
import { SITE } from "@/shared/i18n/site";

export const metadata: Metadata = {
  title: "إنشاء حساب جديد",
  description: `اعمل حسابك على ${SITE.brand} في دقايق — كورسات أحياء وجيولوجيا لتالتة إعدادي وأولى وتالتة ثانوي.`,
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return <RegisterView />;
}
