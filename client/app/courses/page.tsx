import type { Metadata } from "next";
import { CoursesBrowseView } from "@/features/courses/CoursesBrowseView";
import { SITE } from "@/shared/i18n/site";

export const metadata: Metadata = {
  title: "كورسات الأحياء والجيولوجيا",
  description: `كورسات ${SITE.teacherName} في الأحياء والجيولوجيا لتالتة إعدادي وأولى ثانوي وتالتة ثانوي — شرح شامل ومراجعات وامتحانات.`,
  alternates: { canonical: "/courses" },
};

export default function CoursesPage() {
  return <CoursesBrowseView />;
}
