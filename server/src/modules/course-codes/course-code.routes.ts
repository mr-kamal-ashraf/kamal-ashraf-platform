import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { validate } from "../../shared/middlewares/validate.middleware";
import { authenticateStudent } from "../../shared/middlewares/auth.middleware";
import { codeRedeemLimiter } from "../../shared/middlewares/rateLimit.middleware";
import { ApiError } from "../../shared/utils/ApiError";
import { redeemCode } from "./course-code.service";
import { redeemCodeSchema, type RedeemCodeInput } from "./course-code.validation";

/** Student router for prepaid course codes, mounted at /course-codes. */
const router = Router();

/**
 * POST /course-codes/redeem { code, courseId? }
 * Opens the code's course for the signed-in student — typed on a course's
 * page (courseId), only if the code is for that course. Failed attempts are
 * rate limited (codeRedeemLimiter) on top of the codes' huge keyspace.
 */
router.post(
  "/redeem",
  authenticateStudent(),
  codeRedeemLimiter,
  validate(redeemCodeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { code, courseId } = req.body as RedeemCodeInput;
    const result = await redeemCode({ userId: req.user.id, code, courseId });
    return sendSuccess(res, {
      message: `تم فتح كورس «${result.course.title}» 🎉`,
      data: result,
    });
  }),
);

export default router;
