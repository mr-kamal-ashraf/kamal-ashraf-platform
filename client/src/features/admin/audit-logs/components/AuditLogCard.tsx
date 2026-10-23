import type { AuditLogEntry } from "@/api/types";
import { AUDIT_ACTION_LABELS } from "../config/action-labels";
import { formatAdminName, formatTargetName } from "../lib/formatters";

export function AuditLogCard({ log }: { log: AuditLogEntry }) {
  const adminName = formatAdminName(log);
  const targetName = formatTargetName(log);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
          {AUDIT_ACTION_LABELS[log.action] || log.action}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {new Date(log.createdAt).toLocaleString("ar-EG")}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">الأدمن</dt>
          <dd className="truncate font-bold">{adminName}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">الطالب المستهدف</dt>
          <dd className="truncate">{targetName}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">IP</dt>
          <dd className="font-mono text-muted-foreground">
            {log.ipAddress || "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
