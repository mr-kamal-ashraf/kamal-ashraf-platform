import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { User } from "../users/user.model";
import { Lesson } from "../lessons/lesson.model";
import { Enrollment } from "../enrollments/enrollment.model";
import { ENROLLMENT_STATUS } from "../../config/constants";
import { getSalesSummary } from "../sales/sales.service";
import { countRefundAlerts } from "../payments/payment.service";

/**
 * GET /admin/dashboard
 * Returns a snapshot of key platform metrics for the admin dashboard:
 *  - Student counts broken down by activation/suspension status and academic stage.
 *  - Course-ownership counts: active enrollments, students who own >=1 course.
 *  - Lesson counts: total, published, draft.
 *  - Sales: total revenue, this month's revenue, and the number of sales —
 *    sourced from the sales report so the card and the /admin/sales page can
 *    never disagree about what a sale is worth.
 *  - refundAlerts: paid payments still waiting to be refunded (a banner).
 */
export async function getStats(_req: Request, res: Response) {
  const [
    totalStudents,
    activeStudents,
    pendingActivation,
    suspendedStudents,
    activeEnrollments,
    studentsWithCourses,
    totalLessons,
    publishedLessons,
    studentsByStage,
    sales,
    refundAlerts,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isActive: true, isSuspended: false }),
    User.countDocuments({ isActive: false, isSuspended: false }),
    User.countDocuments({ isSuspended: true }),
    Enrollment.countDocuments({ status: ENROLLMENT_STATUS.ACTIVE }),
    Enrollment.distinct("userId", { status: ENROLLMENT_STATUS.ACTIVE }),
    Lesson.countDocuments({}),
    Lesson.countDocuments({ isPublished: true }),
    User.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$stage", count: { $sum: 1 } } },
    ]),
    getSalesSummary(),
    countRefundAlerts(),
  ]);

  const stageBreakdown = studentsByStage.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item._id] = item.count;
      return acc;
    },
    { first: 0, second: 0, third: 0 }
  );

  return sendSuccess(res, {
    data: {
      students: {
        total: totalStudents,
        active: activeStudents,
        pendingActivation,
        suspended: suspendedStudents,
        byStage: stageBreakdown,
      },
      enrollments: {
        active: activeEnrollments,
        studentsWithCourses: (studentsWithCourses as unknown[]).length,
      },
      sales: {
        currency: sales.currency,
        totalRevenue: sales.totalRevenue,
        monthRevenue: sales.monthRevenue,
        salesCount: sales.salesCount,
        monthSalesCount: sales.monthSalesCount,
      },
      lessons: {
        total: totalLessons,
        published: publishedLessons,
        draft: totalLessons - publishedLessons,
      },
      refundAlerts,
      generatedAt: new Date(),
    },
  });
}
