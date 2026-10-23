import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { formatCairoDateTime } from "../../shared/utils/date";
import {
  getSalesSummary,
  listAllSalesForExport,
  listSales,
  type SaleListItem,
} from "./sales.service";
import { exportSalesQuerySchema, listSalesQuerySchema } from "./sales.validation";

/**
 * Admin-facing endpoints for the sales report.
 * All mounted under /admin/sales (admin JWT enforced by the parent router).
 *
 * Query strings are parsed with Zod here rather than in the route: Express 5
 * makes req.query read-only, so the shared validate() middleware cannot hand
 * the coerced values (page, limit) back to the handler. A ZodError thrown here
 * is caught by asyncHandler and formatted as a 422 by the error middleware,
 * exactly as it would be from the middleware.
 */

const SOURCE_LABELS: Record<string, string> = {
  paymob: "أونلاين",
  cash: "كاش",
  code: "كود",
};

const STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  revoked: "ملغي",
};

/** Wraps a CSV cell so commas, quotes and newlines inside it stay intact. */
function csvCell(value: string | number | null): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** Renders the export rows as a spreadsheet-friendly CSV document. */
function toCsv(items: SaleListItem[]): string {
  const header = [
    "التاريخ والوقت",
    "الطالب",
    "رقم الطالب",
    "رقم ولي الأمر",
    "الكورس",
    "المبلغ",
    "العملة",
    "طريقة الدفع",
    "الحالة",
    "رقم العملية",
    "ملاحظات",
  ];

  const rows = items.map((item) =>
    [
      csvCell(formatCairoDateTime(new Date(item.soldAt))),
      csvCell(item.student?.name ?? ""),
      csvCell(item.student?.studentPhone ?? ""),
      csvCell(item.student?.parentPhone ?? ""),
      csvCell(item.course?.title ?? ""),
      csvCell(item.amount),
      csvCell(item.currency),
      csvCell(SOURCE_LABELS[item.source] ?? item.source),
      csvCell(STATUS_LABELS[item.status] ?? item.status),
      csvCell(item.transactionRef),
      csvCell(item.notes),
    ].join(","),
  );

  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}

/**
 * GET /admin/sales
 * Paginated sales list (online + cash) with filters, newest first.
 */
export async function listSalesHandler(req: Request, res: Response) {
  const query = listSalesQuerySchema.parse(req.query);
  const result = await listSales(query);
  return sendSuccess(res, { message: "Sales", data: result });
}

/**
 * GET /admin/sales/summary
 * Headline revenue figures, best-selling courses, and unfinished online checkouts.
 */
export async function salesSummaryHandler(_req: Request, res: Response) {
  const data = await getSalesSummary();
  return sendSuccess(res, { message: "Sales summary", data });
}

/**
 * GET /admin/sales/export
 * Same filters as the list, returned as a UTF-8 CSV the teacher can open in Excel.
 * The BOM prefix is what makes Excel read the Arabic columns correctly.
 */
export async function exportSalesHandler(req: Request, res: Response) {
  const query = exportSalesQuerySchema.parse(req.query);
  const items = await listAllSalesForExport(query);
  const filename = `sales-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(`﻿${toCsv(items)}`);
}
