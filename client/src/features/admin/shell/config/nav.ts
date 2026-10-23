import type { ComponentType } from "react";
import {
  AdminAccountIcon,
  AdminAppearanceIcon,
  AdminExamGeneratorIcon,
  AdminSalesIcon,
  AdminAICurriculumIcon,
  AdminAuditLogsIcon,
  AdminEscalationsIcon,
  AdminWhatsappIcon,
  AdminCoursesIcon,
  AdminDashboardIcon,
  AdminLessonsIcon,
  AdminStudentsIcon,
} from "../components/icons";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: ComponentType;
  /**
   * Heading this item sits under in the sidebar. Consecutive items sharing a
   * group render once under that heading; items without one sit at the top
   * level. Keep grouped items adjacent — the sidebar prints a heading whenever
   * the group changes.
   */
  group?: string;
}

/** Heading for the AI-powered tools (قسم «خدمات الـ AI»). */
export const AI_SERVICES_GROUP = "خدمات الـ AI";

/** Heading for the platform & account settings. */
export const SETTINGS_GROUP = "الإعدادات";

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "لوحة التحكم", icon: AdminDashboardIcon },
  { href: "/admin/students", label: "الطلاب", icon: AdminStudentsIcon },
  { href: "/admin/courses", label: "الكورسات", icon: AdminCoursesIcon },
  { href: "/admin/lessons", label: "الدروس", icon: AdminLessonsIcon },
  { href: "/admin/sales", label: "المبيعات", icon: AdminSalesIcon },
  {
    href: "/admin/ai/exam-generator",
    label: "مولّد الامتحانات",
    icon: AdminExamGeneratorIcon,
    group: AI_SERVICES_GROUP,
  },
  {
    href: "/admin/ai/curriculum",
    label: "منهج المساعد الذكي",
    icon: AdminAICurriculumIcon,
    group: AI_SERVICES_GROUP,
  },
  {
    href: "/admin/escalations",
    label: "تصعيدات الدعم",
    icon: AdminEscalationsIcon,
  },
  {
    href: "/admin/whatsapp",
    label: "ربط واتساب",
    icon: AdminWhatsappIcon,
  },
  {
    href: "/admin/audit-logs",
    label: "سجل الإجراءات",
    icon: AdminAuditLogsIcon,
  },
  {
    href: "/admin/appearance",
    label: "المظهر والمحتوى",
    icon: AdminAppearanceIcon,
    group: SETTINGS_GROUP,
  },
  {
    href: "/admin/account",
    label: "حسابي",
    icon: AdminAccountIcon,
    group: SETTINGS_GROUP,
  },
];
