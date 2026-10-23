export type StudentStatusFilter = "" | "active" | "pending" | "suspended";

export const STUDENT_STATUS_VALUES = [
  "active",
  "pending",
  "suspended",
] as const;

export const STUDENT_STATUS_LABELS: Record<
  Exclude<StudentStatusFilter, "">,
  string
> = {
  active: "مفعل",
  pending: "بانتظار التفعيل",
  suspended: "معلق",
};
