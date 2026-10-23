import { Router } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { validate } from "../../shared/middlewares/validate.middleware";
import {
  deleteCodesHandler,
  exportCodesHandler,
  generateCodesHandler,
  listCodesHandler,
  printCodesHandler,
  setCodeDisabledHandler,
} from "./course-code.admin.controller";
import {
  deleteCodesSchema,
  generateCodesSchema,
  setCodeDisabledSchema,
} from "./course-code.validation";

/**
 * Admin router for prepaid course codes, mounted at /admin/course-codes.
 * The parent admin router already enforces the admin JWT.
 */
const router = Router();

router.post("/", validate(generateCodesSchema), asyncHandler(generateCodesHandler));
router.post(
  "/bulk-delete",
  validate(deleteCodesSchema),
  asyncHandler(deleteCodesHandler),
);
router.get("/export", asyncHandler(exportCodesHandler));
router.get("/print", asyncHandler(printCodesHandler));
router.get("/", asyncHandler(listCodesHandler));
router.patch(
  "/:id",
  validate(setCodeDisabledSchema),
  asyncHandler(setCodeDisabledHandler),
);

export default router;
