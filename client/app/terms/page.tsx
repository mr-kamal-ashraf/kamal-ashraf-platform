import type { Metadata } from "next";
import { TermsView } from "@/features/legal/TermsView";
import { SITE } from "@/shared/i18n/site";

export const metadata: Metadata = {
  title: "الشروط والأحكام",
  description: `الشروط والأحكام الخاصة باستخدام منصة ${SITE.teacherName} وشراء الكورسات ومشاهدة المحتوى التعليمي.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <TermsView />;
}
