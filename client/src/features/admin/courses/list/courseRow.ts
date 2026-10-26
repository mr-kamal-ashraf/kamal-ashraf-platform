import type { CourseAdminItem } from "@/api/types";

/** A hidden course's next step, in the teacher's words (null once it's out). */
export function nextStepText(course: CourseAdminItem): string | null {
  if (course.isPublished) return null;
  if (course.lessonsCount === 0) return "الخطوة الجاية: ضيف أول درس.";
  if (course.publishedLessonsCount === 0) return "الخطوة الجاية: انشر درس واحد على الأقل.";
  return "جاهز — دوس «نشر» عشان يظهر للطلاب.";
}

/** Why it can't be published yet (the server refuses an empty course too). */
export function publishLockedReason(course: CourseAdminItem): string | null {
  return !course.isPublished && course.publishedLessonsCount === 0
    ? "لازم يكون في الكورس درس منشور الأول"
    : null;
}

export const priceText = (course: CourseAdminItem) =>
  course.price > 0 ? `${course.price} جنيه` : "مجاني";

/** The row/card actions, shared by the table and the phone cards. */
export interface CourseRowActions {
  onTogglePublish: (course: CourseAdminItem) => void;
  onDelete: (course: CourseAdminItem) => void;
  isSelected: (courseId: string) => boolean;
  onToggleSelect: (courseId: string) => void;
}
