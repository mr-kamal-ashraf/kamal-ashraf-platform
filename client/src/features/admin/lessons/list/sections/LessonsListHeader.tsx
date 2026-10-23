import Link from "next/link";

export function LessonsListHeader() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
          الدروس
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">إدارة كل الدروس</p>
      </div>
      <Link
        href="/admin/lessons/new"
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-brand"
      >
        + درس جديد
      </Link>
    </div>
  );
}
