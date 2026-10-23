import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { recordAuditLog } from "../audit-logs/audit-log.service";
import { AUDIT_ACTIONS } from "../audit-logs/audit-log.model";
import {
  deleteCodes,
  generateCodes,
  listCodes,
  listCodesForExport,
  setCodeDisabled,
  type CourseCodeItem,
} from "./course-code.service";
import {
  exportCodesQuerySchema,
  listCodesQuerySchema,
  type DeleteCodesInput,
  type GenerateCodesInput,
} from "./course-code.validation";

/*
 * Admin endpoints for prepaid course codes, mounted at /admin/course-codes
 * (the parent admin router enforces the admin JWT). Query strings are parsed
 * here — Express 5's req.query is read-only, so validate() can't hand back
 * coerced values; a ZodError still becomes a 422 via asyncHandler.
 */

const STATUS_LABELS: Record<string, string> = {
  available: "متاح",
  used: "مستخدم",
  disabled: "متوقف",
};

function csvCell(value: string | number | null): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(courseTitle: string, items: CourseCodeItem[]): string {
  const header = [
    "الكود",
    "الكورس",
    "الحالة",
    "السعر",
    "الدفعة",
    "تاريخ الإنشاء",
    "استخدمه",
    "رقم الطالب",
    "تاريخ الاستخدام",
  ];
  const rows = items.map((item) =>
    [
      csvCell(item.code),
      csvCell(courseTitle),
      csvCell(STATUS_LABELS[item.status] ?? item.status),
      csvCell(item.price),
      csvCell(item.batchLabel),
      csvCell(new Date(item.createdAt).toISOString().slice(0, 10)),
      csvCell(item.usedBy?.name ?? ""),
      csvCell(item.usedBy?.studentPhone ?? ""),
      csvCell(item.usedAt ? new Date(item.usedAt).toISOString().slice(0, 10) : ""),
    ].join(","),
  );
  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}

/** POST /admin/course-codes — generate a batch. */
export async function generateCodesHandler(req: Request, res: Response) {
  const input = req.body as GenerateCodesInput;
  const result = await generateCodes({ ...input, adminId: req.user!.id });

  await recordAuditLog({
    adminId: req.user!.id,
    action: AUDIT_ACTIONS.GENERATE_COURSE_CODES,
    targetCourseId: input.courseId,
    metadata: {
      batchId: result.batchId,
      count: result.codes.length,
      price: result.price,
      label: result.label,
    },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: `تم إنشاء ${result.codes.length} كود`,
    data: result,
  });
}

/** GET /admin/course-codes?courseId=&status=&batchId=&search=&page=&limit= */
export async function listCodesHandler(req: Request, res: Response) {
  const query = listCodesQuerySchema.parse(req.query);
  const data = await listCodes(query);
  return sendSuccess(res, { message: "Course codes", data });
}

/** GET /admin/course-codes/export?courseId=&status=&batchId= — CSV for Excel. */
export async function exportCodesHandler(req: Request, res: Response) {
  const query = exportCodesQuerySchema.parse(req.query);
  const { courseTitle, items } = await listCodesForExport(query);
  const filename = `course-codes-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // The BOM makes Excel read the Arabic columns correctly.
  return res.send(`﻿${toCsv(courseTitle, items)}`);
}

/** GET /admin/course-codes/print?courseId=&status=&batchId= — the codes for a print sheet. */
export async function printCodesHandler(req: Request, res: Response) {
  const query = exportCodesQuerySchema.parse(req.query);
  const data = await listCodesForExport(query);
  return sendSuccess(res, { message: "Course codes", data });
}

/** PATCH /admin/course-codes/:id { disabled } — switch an unused code off/on. */
export async function setCodeDisabledHandler(req: Request, res: Response) {
  const { disabled } = req.body as { disabled: boolean };
  const id = String(req.params.id);
  const result = await setCodeDisabled(id, disabled);

  await recordAuditLog({
    adminId: req.user!.id,
    action: disabled
      ? AUDIT_ACTIONS.DISABLE_COURSE_CODE
      : AUDIT_ACTIONS.ENABLE_COURSE_CODE,
    targetCourseId: result.courseId,
    metadata: { code: result.code },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    message: disabled ? "تم إيقاف الكود" : "تم تفعيل الكود",
    data: { id: result.id, status: result.status },
  });
}

/** POST /admin/course-codes/bulk-delete { codeIds } — remove codes for good. */
export async function deleteCodesHandler(req: Request, res: Response) {
  const { codeIds } = req.body as DeleteCodesInput;
  const result = await deleteCodes(codeIds);

  await recordAuditLog({
    adminId: req.user!.id,
    action: AUDIT_ACTIONS.DELETE_COURSE_CODES,
    targetCourseId: result.courseId,
    metadata: { count: result.deleted, codes: result.codes.slice(0, 50) },
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });

  return sendSuccess(res, {
    message: `تم مسح ${result.deleted} كود`,
    data: { deleted: result.deleted },
  });
}
