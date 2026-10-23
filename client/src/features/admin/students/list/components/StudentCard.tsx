import Link from "next/link";
import type { User } from "@/api/types";
import { STAGE_LABELS } from "@/shared/lib/stage";
import { StudentStatusBadge } from "../../components/StudentStatusBadge";
import { CommitmentBadge } from "../../components/CommitmentBadge";

export function StudentCard({
  student,
  selected,
  onToggleSelect,
}: {
  student: User;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <article
      className={`rounded-2xl border bg-card p-4 shadow-soft transition-colors hover:border-primary/40 ${
        selected ? "border-primary/60 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/students/${student._id}`}
            className="block truncate text-sm font-extrabold text-primary hover:underline"
          >
            {student.firstName} {student.secondName} {student.thirdName}
          </Link>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {STAGE_LABELS[student.stage]}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StudentStatusBadge user={student} />
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`تحديد ${student.firstName} ${student.secondName} ${student.thirdName}`}
            className="size-4 shrink-0 accent-primary"
          />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">رقم الطالب</dt>
          <dd className="mt-0.5 font-mono font-bold">{student.studentPhone}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">رقم ولي الأمر</dt>
          <dd className="mt-0.5 font-mono font-bold">{student.parentPhone}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        <span>
          مسجّل من: {new Date(student.createdAt).toLocaleDateString("ar-EG")}
        </span>
        <CommitmentBadge commitment={student.commitment} />
      </div>
    </article>
  );
}
