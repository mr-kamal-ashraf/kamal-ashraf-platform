import type { Metadata } from "next";
import { ForgotPasswordView } from "@/features/auth/forgot-password/ForgotPasswordView";

export const metadata: Metadata = {
  title: "نسيت كلمة السر",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordView />;
}
