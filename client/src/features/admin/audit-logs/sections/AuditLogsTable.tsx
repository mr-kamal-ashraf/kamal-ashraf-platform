"use client";

import { useAuditLogs } from "../AuditLogsProvider";
import { AuditLogCard } from "../components/AuditLogCard";
import { AUDIT_ACTION_LABELS } from "../config/action-labels";
import { formatAdminName, formatTargetName } from "../lib/formatters";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

export function AuditLogsTable() {
  const { isLoading, error, data } = useAuditLogs();

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  // First load: the full loading screen. A reload (search / filter / page)
  // keeps the current rows up, dimmed, until the new ones arrive.
  if (isLoading && !data) return <LoadingScreen variant="page" />;

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
        مفيش سجل إجراءات
      </div>
    );
  }

  return (
    <div
      aria-busy={isLoading}
      className={isLoading ? "brand-loader--refreshing space-y-5 sm:space-y-6" : "space-y-5 sm:space-y-6"}
    >
      <ul className="grid gap-3 lg:hidden">
        {data.items.map((log) => (
          <li key={log._id}>
            <AuditLogCard log={log} />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">الإجراء</th>
                <th className="px-4 py-3">الأدمن</th>
                <th className="px-4 py-3">الطالب المستهدف</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => {
                const adminName = formatAdminName(log);
                const targetName = formatTargetName(log);
                return (
                  <tr key={log._id} className="border-t border-border/60">
                    <td className="px-4 py-3 text-xs">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                        {AUDIT_ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold">{adminName}</td>
                    <td className="px-4 py-3 text-xs">{targetName}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {log.ipAddress || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("ar-EG")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
