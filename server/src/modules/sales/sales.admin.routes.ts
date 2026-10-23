import { Router } from "express";
import {
  exportSalesHandler,
  listSalesHandler,
  salesSummaryHandler,
} from "./sales.admin.controller";
import { asyncHandler } from "../../shared/utils/asyncHandler";

/**
 * Admin router for the sales report.
 * Mounted at /admin/sales; the parent admin router already enforces the admin
 * JWT, so no extra auth middleware is needed here.
 */
const router = Router();

/**
 * GET /admin/sales/summary
 * Declared before the list route so "summary" is never mistaken for a filter value.
 */
router.get("/summary", asyncHandler(salesSummaryHandler));

/** GET /admin/sales/export?<same filters as the list> — CSV download. */
router.get("/export", asyncHandler(exportSalesHandler));

/** GET /admin/sales?search=&source=&status=&stage=&courseId=&from=&to=&page=&limit= */
router.get("/", asyncHandler(listSalesHandler));

export default router;
