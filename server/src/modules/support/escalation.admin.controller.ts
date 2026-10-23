import type { Request, Response } from "express";
import { Types } from "mongoose";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { SupportEscalation, ESCALATION_STATUS } from "./escalation.model";

/**
 * Admin-facing endpoints for the support-agent escalation inbox.
 * All mounted under /admin/escalations (admin JWT required by the parent router).
 */

/**
 * GET /admin/escalations?status=open|resolved|all&page=1&limit=20
 * Lists escalations newest-first with a total count and an open-count badge.
 */
export async function listEscalations(req: Request, res: Response) {
  const statusRaw = String(req.query.status ?? "open").toLowerCase();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const filter: Record<string, unknown> = {};
  if (statusRaw === "open") filter.status = ESCALATION_STATUS.OPEN;
  else if (statusRaw === "resolved") filter.status = ESCALATION_STATUS.RESOLVED;
  // "all" => no status filter

  const [items, total, openCount] = await Promise.all([
    SupportEscalation.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SupportEscalation.countDocuments(filter),
    SupportEscalation.countDocuments({ status: ESCALATION_STATUS.OPEN }),
  ]);

  return sendSuccess(res, {
    message: "Escalations",
    data: {
      items: items.map((e) => ({
        id: String(e._id),
        from_phone: e.fromPhone,
        student_id: e.studentId ? String(e.studentId) : null,
        student_name: e.studentName,
        category: e.category,
        summary: e.summary,
        status: e.status,
        teacher_notified: e.teacherNotified,
        created_at: e.createdAt,
        resolved_at: e.resolvedAt,
      })),
      page,
      limit,
      total,
      open_count: openCount,
    },
  });
}

/**
 * PATCH /admin/escalations/:id/resolve
 * Marks an escalation resolved (records who + when). Idempotent.
 */
export async function resolveEscalation(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest("معرّف غير صحيح", "INVALID_ESCALATION_ID");
  }

  const escalation = await SupportEscalation.findById(id);
  if (!escalation) {
    throw ApiError.notFound("التصعيد غير موجود", "ESCALATION_NOT_FOUND");
  }

  if (escalation.status !== ESCALATION_STATUS.RESOLVED) {
    escalation.status = ESCALATION_STATUS.RESOLVED;
    escalation.resolvedAt = new Date();
    escalation.resolvedBy = new Types.ObjectId(req.user.id);
    await escalation.save();
  }

  return sendSuccess(res, {
    message: "تم وضع التصعيد كمُحلّ",
    data: { id: String(escalation._id), status: escalation.status },
  });
}
