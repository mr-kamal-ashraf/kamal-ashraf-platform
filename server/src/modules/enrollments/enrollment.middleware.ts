import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../../shared/utils/ApiError";
import { User } from "../users/user.model";
import { Enrollment } from "./enrollment.model";
import { ACCESS_DENIAL_REASONS, ENROLLMENT_STATUS } from "../../config/constants";
import { asyncHandler } from "../../shared/utils/asyncHandler";

/**
 * Course-ownership gate for buy-course-model features that used to require an
 * active subscription (e.g. the student AI tutor).
 *
 * A request passes only when ALL of the following are true:
 *  1. Student is authenticated.
 *  2. Account exists, is not suspended, and is not pending activation.
 *  3. Student owns at least ONE active course (an active enrollment).
 *
 * This replaces the old requireActiveSubscription gate: after the pivot there
 * is no subscription to check — access is granted by owning a course.
 */
export const requireCourseOwnership = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        ApiError.unauthorized(
          "غير مصرح لك بالدخول",
          ACCESS_DENIAL_REASONS.NOT_AUTHENTICATED,
        ),
      );
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      throw ApiError.unauthorized("المستخدم غير موجود", "USER_NOT_FOUND");
    }
    if (user.isSuspended) {
      throw ApiError.forbidden(
        "حسابك معلّق. تواصل مع الدعم",
        ACCESS_DENIAL_REASONS.ACCOUNT_SUSPENDED,
      );
    }

    const ownsAny = await Enrollment.exists({
      userId: user._id,
      status: ENROLLMENT_STATUS.ACTIVE,
    });
    if (!ownsAny) {
      throw ApiError.forbidden(
        "لازم تشتري كورس الأول عشان تستخدم المساعد الذكي",
        ACCESS_DENIAL_REASONS.NOT_ENROLLED,
      );
    }

    next();
  },
);
