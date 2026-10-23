import { Router } from "express";
import { list } from "./audit-log.controller";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = Router();

/**
 * GET /admin/audit-logs
 * Returns a paginated list of audit log entries for the platform.
 * Tracks admin actions (login, lesson edits, student management, etc.) for accountability.
 */
router.get("/", asyncHandler(list));

export default router;
