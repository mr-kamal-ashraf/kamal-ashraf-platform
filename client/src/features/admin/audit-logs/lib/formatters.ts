import type { AuditLogEntry } from "@/api/types";

export function formatAdminName(log: AuditLogEntry): string {
  if (typeof log.adminId === "object" && log.adminId) {
    return log.adminId.name || log.adminId.email || "—";
  }
  return "—";
}

export function formatTargetName(log: AuditLogEntry): string {
  if (typeof log.targetUserId === "object" && log.targetUserId) {
    return `${log.targetUserId.firstName} ${log.targetUserId.secondName}`;
  }
  return "—";
}
