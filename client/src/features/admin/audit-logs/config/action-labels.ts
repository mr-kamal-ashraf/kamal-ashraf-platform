/**
 * Arabic label for every audit-log action code.
 *
 * The canonical list of action codes lives on the backend in
 * `server/src/modules/audit-logs/audit-log.model.ts` (AUDIT_ACTIONS). This
 * map must always have one entry per code there — a missing entry falls
 * back to the raw English code in the UI (see AuditLogCard / AuditLogsTable),
 * which is exactly how "UPDATE_COURSE" used to leak through untranslated.
 * Whenever a new action is added on the backend, add its Arabic label here
 * too.
 */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Admin session
  ADMIN_LOGIN: "دخول أدمن",
  ADMIN_LOGOUT: "خروج أدمن",

  // Students
  ACTIVATE_USER: "تفعيل طالب",
  SUSPEND_USER: "تعليق طالب",
  UNSUSPEND_USER: "إلغاء تعليق",
  DELETE_USER: "حذف طالب",
  RESET_USER_PASSWORD: "إعادة تعيين كلمة سر طالب",
  REVOKE_USER_SESSION: "إنهاء جلسة",

  // Subscriptions
  ACTIVATE_SUBSCRIPTION: "تفعيل اشتراك",
  EXTEND_SUBSCRIPTION: "تمديد اشتراك",
  CANCEL_SUBSCRIPTION: "إلغاء اشتراك",

  // Lessons
  CREATE_LESSON: "إنشاء درس",
  UPDATE_LESSON: "تعديل درس",
  DELETE_LESSON: "حذف درس",
  PUBLISH_LESSON: "نشر درس",
  UNPUBLISH_LESSON: "إخفاء درس",

  // Courses
  CREATE_COURSE: "إنشاء كورس",
  UPDATE_COURSE: "تعديل كورس",
  DELETE_COURSE: "حذف كورس",
  PUBLISH_COURSE: "نشر كورس",
  UNPUBLISH_COURSE: "إخفاء كورس",
  GRANT_COURSE_ACCESS: "منح وصول لكورس",
  REVOKE_COURSE_ACCESS: "سحب وصول من كورس",
  GENERATE_COURSE_CODES: "إنشاء أكواد كورس",
  DISABLE_COURSE_CODE: "إيقاف كود كورس",
  ENABLE_COURSE_CODE: "تفعيل كود كورس",
  DELETE_COURSE_CODES: "مسح أكواد كورس",
  RESOLVE_REFUND_ALERT: "استرجاع دفعة لطالب",

  // Account & platform settings
  CHANGE_ADMIN_PASSWORD: "تغيير كلمة سر الأدمن",
  UPDATE_SITE_SETTINGS: "تعديل مظهر ومحتوى المنصة",
};
