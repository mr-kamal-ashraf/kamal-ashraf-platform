import { Router } from "express";
import {
  listEscalations,
  resolveEscalation,
} from "./escalation.admin.controller";
import { asyncHandler } from "../../shared/utils/asyncHandler";

/**
 * Admin router for the support-agent escalation inbox.
 * Mounted at /admin/escalations; the parent admin router already enforces the
 * admin JWT, so no extra auth middleware is needed here.
 */
const router = Router();

/** GET /admin/escalations?status=open|resolved|all&page=&limit= */
router.get("/", asyncHandler(listEscalations));

/** PATCH /admin/escalations/:id/resolve */
router.patch("/:id/resolve", asyncHandler(resolveEscalation));

export default router;
