import { Types, type PipelineStage } from "mongoose";
import { Enrollment } from "../enrollments/enrollment.model";
import { Payment } from "../payments/payment.model";
import {
  DEFAULT_CURRENCY,
  ENROLLMENT_STATUS,
  PAYMENT_STATUS,
  type EnrollmentSource,
  type EnrollmentStatus,
  type Stage,
} from "../../config/constants";
import { buildSafeRegex } from "../../shared/utils/regex";
import { parseDateFilter, startOfDay, startOfMonth } from "../../shared/utils/date";
import type { ListSalesQuery } from "./sales.validation";

/**
 * Reporting layer for everything the teacher sold.
 *
 * SOURCE OF TRUTH: the Enrollment collection, not Payment. Payment only ever
 * records Paymob attempts, so a report built on it would hide every course the
 * teacher opened manually after taking cash in person. Enrollment holds both
 * (`source` = paymob | cash) together with the amount recorded at sale time.
 *
 * Payment is still consulted, but only for the two things it alone knows:
 * the gateway transaction reference of an online sale, and how many checkout
 * attempts never completed.
 */

/** How far back the unfinished-checkout counters look. */
const PAYMENT_ATTEMPTS_WINDOW_DAYS = 30;

export interface SaleListItem {
  id: string;
  student: {
    id: string;
    name: string;
    studentPhone: string;
    parentPhone: string;
    stage: Stage;
  } | null;
  course: { id: string; title: string; stage: Stage } | null;
  amount: number;
  currency: string;
  source: EnrollmentSource;
  status: EnrollmentStatus;
  soldAt: Date;
  revokedAt: Date | null;
  notes: string | null;
  transactionRef: string | null;
}

export interface SalesListResult {
  items: SaleListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Revenue of the ACTIVE sales matching the current filters, not just this page. */
  filteredRevenue: number;
}

export interface SalesSummary {
  currency: string;
  totalRevenue: number;
  monthRevenue: number;
  todayRevenue: number;
  cashRevenue: number;
  onlineRevenue: number;
  codeRevenue: number;
  salesCount: number;
  monthSalesCount: number;
  averageSale: number;
  revokedCount: number;
  revokedAmount: number;
  /**
   * Online checkouts from the last 30 days that never completed. Scoped to a
   * recent window on purpose: an all-time count of abandoned carts only grows
   * and tells the teacher nothing, a recent one flags a gateway problem.
   */
  pendingAttempts: number;
  failedAttempts: number;
  attemptsWindowDays: number;
  topCourses: { id: string; title: string; salesCount: number; revenue: number }[];
}

/** When a sale happened: the latest grant (a re-buy after a revoke reuses the
 *  record), or the record's creation for ones from before grantedAt existed. */
const SOLD_AT = { $ifNull: ["$grantedAt", "$createdAt"] };

/** Raw aggregation row before it is mapped to the API shape. */
interface SaleAggregateRow {
  _id: Types.ObjectId;
  amountPaid: number;
  source: EnrollmentSource;
  status: EnrollmentStatus;
  soldAt: Date;
  revokedAt: Date | null;
  notes: string | null;
  paymentId: Types.ObjectId | null;
  student?: {
    _id: Types.ObjectId;
    firstName: string;
    secondName: string;
    thirdName: string;
    studentPhone: string;
    parentPhone: string;
    stage: Stage;
  } | null;
  course?: { _id: Types.ObjectId; title: string; stage: Stage } | null;
}

/**
 * Translates the query-string filters into a Mongo match on Enrollment plus the
 * post-lookup match that the free-text search needs (it spans the joined user
 * and course documents, so it cannot run before the $lookup stages).
 */
function buildMatchStages(query: Omit<ListSalesQuery, "page" | "limit">): {
  base: Record<string, unknown>;
  afterLookup: Record<string, unknown> | null;
} {
  const base: Record<string, unknown> = {};

  if (query.source) base.source = query.source;
  if (query.status) base.status = query.status;
  if (query.stage) base.stage = query.stage;
  if (query.courseId && Types.ObjectId.isValid(query.courseId)) {
    base.courseId = new Types.ObjectId(query.courseId);
  }

  const from = parseDateFilter(query.from);
  const to = parseDateFilter(query.to, { endOfDay: true });
  if (from || to) {
    const range = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lt: to } : {}),
    };
    // Same date as SOLD_AT, written so the match can still use the indexes.
    base.$or = [{ grantedAt: range }, { grantedAt: null, createdAt: range }];
  }

  let afterLookup: Record<string, unknown> | null = null;
  if (query.search) {
    const safe = buildSafeRegex(query.search);
    afterLookup = {
      $or: [
        { "student.firstName": safe },
        { "student.secondName": safe },
        { "student.thirdName": safe },
        { "student.studentPhone": safe },
        { "student.parentPhone": safe },
        { "course.title": safe },
      ],
    };
  }

  return { base, afterLookup };
}

/**
 * Attaches the buyer and the course to each sale, then trims the joined
 * documents down to the fields the report shows.
 *
 * The $project is not an optimisation, it is a boundary: an aggregation
 * $lookup ignores the User schema's `select: false`, so without it the
 * password hash would be pulled into the pipeline. Plain localField /
 * foreignField lookups are used rather than the inline-pipeline form so the
 * report works on MongoDB 4.4 as well as 5.0+.
 */
const LOOKUP_STAGES: PipelineStage[] = [
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "student",
    },
  },
  { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: "courses",
      localField: "courseId",
      foreignField: "_id",
      as: "course",
    },
  },
  { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      amountPaid: 1,
      source: 1,
      status: 1,
      soldAt: SOLD_AT,
      revokedAt: 1,
      notes: 1,
      paymentId: 1,
      "student._id": 1,
      "student.firstName": 1,
      "student.secondName": 1,
      "student.thirdName": 1,
      "student.studentPhone": 1,
      "student.parentPhone": 1,
      "student.stage": 1,
      "course._id": 1,
      "course.title": 1,
      "course.stage": 1,
    },
  },
];

/** Turns an aggregation row plus its gateway reference into the API shape. */
function toSaleItem(
  row: SaleAggregateRow,
  transactionRefs: Map<string, string>,
): SaleListItem {
  const fullName = row.student
    ? `${row.student.firstName} ${row.student.secondName} ${row.student.thirdName}`.trim()
    : "";
  return {
    id: String(row._id),
    student: row.student
      ? {
          id: String(row.student._id),
          name: fullName,
          studentPhone: row.student.studentPhone,
          parentPhone: row.student.parentPhone,
          stage: row.student.stage,
        }
      : null,
    course: row.course
      ? { id: String(row.course._id), title: row.course.title, stage: row.course.stage }
      : null,
    amount: row.amountPaid,
    currency: DEFAULT_CURRENCY,
    source: row.source,
    status: row.status,
    soldAt: row.soldAt,
    revokedAt: row.revokedAt,
    notes: row.notes,
    transactionRef: row.paymentId
      ? transactionRefs.get(String(row.paymentId)) ?? null
      : null,
  };
}

/**
 * Looks up the Paymob transaction reference for the online sales on one page.
 * Kept to the page's payment ids so the report never scans the whole collection.
 */
async function fetchTransactionRefs(
  rows: SaleAggregateRow[],
): Promise<Map<string, string>> {
  const ids = rows
    .map((row) => row.paymentId)
    .filter((id): id is Types.ObjectId => Boolean(id));
  if (ids.length === 0) return new Map();

  const payments = await Payment.find(
    { _id: { $in: ids } },
    { paymobTransactionId: 1, merchantOrderId: 1 },
  ).lean();

  return new Map(
    payments.map((payment) => [
      String(payment._id),
      payment.paymobTransactionId || payment.merchantOrderId,
    ]),
  );
}

/**
 * Paginated list of sales, newest first, with the revenue of the whole filtered
 * set (not just the visible page) so the teacher can total any slice they pick.
 */
export async function listSales(query: ListSalesQuery): Promise<SalesListResult> {
  const page = Math.max(1, query.page);
  const limit = Math.min(100, Math.max(1, query.limit));
  const { base, afterLookup } = buildMatchStages(query);

  const pipeline: PipelineStage[] = [
    { $match: base },
    ...LOOKUP_STAGES,
    ...(afterLookup ? [{ $match: afterLookup }] : []),
    {
      $facet: {
        items: [
          { $sort: { soldAt: -1, _id: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        total: [{ $count: "value" }],
        revenue: [
          { $match: { status: ENROLLMENT_STATUS.ACTIVE } },
          { $group: { _id: null, value: { $sum: "$amountPaid" } } },
        ],
      },
    },
  ];

  const [facet] = await Enrollment.aggregate<{
    items: SaleAggregateRow[];
    total: { value: number }[];
    revenue: { value: number }[];
  }>(pipeline);

  const rows = facet?.items ?? [];
  const total = facet?.total?.[0]?.value ?? 0;
  const transactionRefs = await fetchTransactionRefs(rows);

  return {
    items: rows.map((row) => toSaleItem(row, transactionRefs)),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    filteredRevenue: facet?.revenue?.[0]?.value ?? 0,
  };
}

/** Every sale matching the filters, unpaginated — used by the CSV export only. */
export async function listAllSalesForExport(
  query: Omit<ListSalesQuery, "page" | "limit">,
): Promise<SaleListItem[]> {
  const { base, afterLookup } = buildMatchStages(query);

  const rows = await Enrollment.aggregate<SaleAggregateRow>([
    { $match: base },
    ...LOOKUP_STAGES,
    ...(afterLookup ? [{ $match: afterLookup }] : []),
    { $sort: { soldAt: -1, _id: -1 } },
    // Hard ceiling so a stray export can never pull the whole database into memory.
    { $limit: 5000 },
  ]);

  const transactionRefs = await fetchTransactionRefs(rows);
  return rows.map((row) => toSaleItem(row, transactionRefs));
}

/**
 * Headline numbers for the sales page and the dashboard card.
 *
 * Revenue counts ACTIVE enrollments only: a revoked one is access the teacher
 * took back (a refund or a correction), so leaving it in would overstate what
 * was actually earned. The revoked total is reported separately instead of
 * being quietly dropped.
 */
export async function getSalesSummary(): Promise<SalesSummary> {
  const monthStart = startOfMonth();
  const dayStart = startOfDay();
  const activeMatch = { status: ENROLLMENT_STATUS.ACTIVE };
  const attemptsSince = new Date(
    Date.now() - PAYMENT_ATTEMPTS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const [totals, revoked, topCourses, pendingAttempts, failedAttempts] =
    await Promise.all([
      Enrollment.aggregate<{
        _id: null;
        totalRevenue: number;
        salesCount: number;
        monthRevenue: number;
        monthSalesCount: number;
        todayRevenue: number;
        cashRevenue: number;
        onlineRevenue: number;
        codeRevenue: number;
      }>([
        { $match: activeMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amountPaid" },
            salesCount: { $sum: 1 },
            monthRevenue: {
              $sum: {
                $cond: [{ $gte: [SOLD_AT, monthStart] }, "$amountPaid", 0],
              },
            },
            monthSalesCount: {
              $sum: { $cond: [{ $gte: [SOLD_AT, monthStart] }, 1, 0] },
            },
            todayRevenue: {
              $sum: {
                $cond: [{ $gte: [SOLD_AT, dayStart] }, "$amountPaid", 0],
              },
            },
            cashRevenue: {
              $sum: { $cond: [{ $eq: ["$source", "cash"] }, "$amountPaid", 0] },
            },
            onlineRevenue: {
              $sum: { $cond: [{ $eq: ["$source", "paymob"] }, "$amountPaid", 0] },
            },
            codeRevenue: {
              $sum: { $cond: [{ $eq: ["$source", "code"] }, "$amountPaid", 0] },
            },
          },
        },
      ]),
      Enrollment.aggregate<{ _id: null; count: number; amount: number }>([
        { $match: { status: ENROLLMENT_STATUS.REVOKED } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amountPaid" } } },
      ]),
      Enrollment.aggregate<{
        _id: Types.ObjectId;
        salesCount: number;
        revenue: number;
        title: string;
      }>([
        { $match: activeMatch },
        {
          $group: {
            _id: "$courseId",
            salesCount: { $sum: 1 },
            revenue: { $sum: "$amountPaid" },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "courses",
            localField: "_id",
            foreignField: "_id",
            as: "course",
          },
        },
        { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            salesCount: 1,
            revenue: 1,
            title: { $ifNull: ["$course.title", "كورس محذوف"] },
          },
        },
      ]),
      Payment.countDocuments({
        status: PAYMENT_STATUS.PENDING,
        createdAt: { $gte: attemptsSince },
      }),
      Payment.countDocuments({
        status: PAYMENT_STATUS.FAILED,
        createdAt: { $gte: attemptsSince },
      }),
    ]);

  const row = totals[0];
  const salesCount = row?.salesCount ?? 0;
  const totalRevenue = row?.totalRevenue ?? 0;

  return {
    currency: DEFAULT_CURRENCY,
    totalRevenue,
    monthRevenue: row?.monthRevenue ?? 0,
    todayRevenue: row?.todayRevenue ?? 0,
    cashRevenue: row?.cashRevenue ?? 0,
    onlineRevenue: row?.onlineRevenue ?? 0,
    codeRevenue: row?.codeRevenue ?? 0,
    salesCount,
    monthSalesCount: row?.monthSalesCount ?? 0,
    averageSale: salesCount > 0 ? Math.round(totalRevenue / salesCount) : 0,
    revokedCount: revoked[0]?.count ?? 0,
    revokedAmount: revoked[0]?.amount ?? 0,
    pendingAttempts,
    failedAttempts,
    attemptsWindowDays: PAYMENT_ATTEMPTS_WINDOW_DAYS,
    topCourses: topCourses.map((course) => ({
      id: String(course._id),
      title: course.title,
      salesCount: course.salesCount,
      revenue: course.revenue,
    })),
  };
}
