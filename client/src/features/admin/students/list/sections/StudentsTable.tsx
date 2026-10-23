"use client";

import Link from "next/link";
import { STAGE_LABELS } from "@/shared/lib/stage";
import { useStudentsList } from "../StudentsListProvider";
import { StudentCard } from "../components/StudentCard";
import { StudentStatusBadge } from "../../components/StudentStatusBadge";
import { CommitmentBadge } from "../../components/CommitmentBadge";
import { COMMITMENT_RULE_HINT } from "../../config/commitment-labels";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

export function StudentsTable() {
  const {
    isLoading,
    error,
    data,
    isStudentSelected,
    toggleStudentSelection,
    toggleVisibleStudents,
  } = useStudentsList();

  // First load: the full loading screen. A reload (search / filter / page)
  // keeps the current rows up, dimmed, until the new ones arrive.
  if (isLoading && !data) return <LoadingScreen variant="page" />;

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 py-6 px-4 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
        مفيش طلاب مطابقين للبحث
      </div>
    );
  }

  return (
    <div
      aria-busy={isLoading}
      className={isLoading ? "brand-loader--refreshing space-y-5 sm:space-y-6" : "space-y-5 sm:space-y-6"}
    >
      <ul className="grid gap-3 lg:hidden">
        {data.items.map((student) => (
          <li key={student._id}>
            <StudentCard
              student={student}
              selected={isStudentSelected(student._id)}
              onToggleSelect={() => toggleStudentSelection(student._id)}
            />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      !!data.items.length &&
                      data.items.every((student) =>
                        isStudentSelected(student._id),
                      )
                    }
                    onChange={toggleVisibleStudents}
                    aria-label="تحديد أو إلغاء تحديد طلاب الصفحة"
                    className="size-4 accent-primary"
                  />
                </th>
                <th className="px-4 py-3">الطالب</th>
                <th className="px-4 py-3">رقم الطالب</th>
                <th className="px-4 py-3">رقم ولي الأمر</th>
                <th className="px-4 py-3">المرحلة</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3" title={COMMITMENT_RULE_HINT}>
                  الالتزام (الشهر ده)
                </th>
                <th className="px-4 py-3">تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((student) => (
                <tr
                  key={student._id}
                  className={`border-t border-border/60 transition-colors hover:bg-muted/30 ${
                    isStudentSelected(student._id) ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isStudentSelected(student._id)}
                      onChange={() => toggleStudentSelection(student._id)}
                      aria-label={`تحديد ${student.firstName} ${student.secondName} ${student.thirdName}`}
                      className="size-4 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/students/${student._id}`}
                      className="font-bold text-primary hover:underline"
                    >
                      {student.firstName} {student.secondName}{" "}
                      {student.thirdName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {student.studentPhone}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {student.parentPhone}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {STAGE_LABELS[student.stage]}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <StudentStatusBadge user={student} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <CommitmentBadge commitment={student.commitment} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(student.createdAt).toLocaleDateString("ar-EG")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
