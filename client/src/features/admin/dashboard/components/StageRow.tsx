import Link from "next/link";

interface StageRowProps {
  label: string;
  value: number;
  total: number;
  /** Where the row drills down to — the students page filtered to this stage. */
  href?: string;
}

export function StageRow({ label, value, total, href }: StageRowProps) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">{label}</span>
        <span className="text-xs font-bold text-primary">{percent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-brand transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {value.toLocaleString("ar-EG")} طالب
      </div>
    </>
  );

  const className = "block rounded-xl border border-border bg-background p-4";

  if (!href) return <div className={className}>{body}</div>;

  return (
    <Link
      href={href}
      className={`${className} transition-colors hover:border-primary/40`}
    >
      {body}
    </Link>
  );
}
