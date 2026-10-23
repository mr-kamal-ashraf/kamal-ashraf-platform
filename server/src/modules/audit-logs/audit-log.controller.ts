import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { listAuditLogs } from "./audit-log.service";
import type { AuditAction } from "./audit-log.model";

/**
 * GET /admin/audit-logs
 * Returns a paginated list of admin action logs.
 * Supports optional filters: action type, admin ID, and target user ID.
 * Used by the admin panel to review what actions have been taken and by whom.
 */
export async function list(req: Request, res: Response) {
  const result = await listAuditLogs({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    action: req.query.action as AuditAction | undefined,
    adminId: req.query.adminId as string | undefined,
    targetUserId: req.query.targetUserId as string | undefined,
  });

  return sendSuccess(res, { data: result });
}
