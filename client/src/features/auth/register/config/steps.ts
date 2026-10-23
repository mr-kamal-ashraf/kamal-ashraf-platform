/** Ordered wizard steps for student registration. */
export const REGISTER_STEPS = [
  { title: "اسم الطالب" },
  { title: "أرقام التواصل" },
  { title: "تأكيد الأرقام" },
  { title: "المرحلة الدراسية" },
  { title: "كلمة السر" },
] as const;

export const TOTAL_STEPS = REGISTER_STEPS.length;
