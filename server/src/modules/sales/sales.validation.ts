import { z } from "zod";
import {
  ENROLLMENT_SOURCE,
  ENROLLMENT_STATUS,
  STAGES,
} from "../../config/constants";

/**
 * Query schema for GET /admin/sales.
 *
 * A "sale" is an Enrollment record, because that is the only place where BOTH
 * revenue streams meet: online Paymob payments AND cash sales the teacher opens
 * by hand. The Payment collection only ever holds Paymob attempts, so listing it
 * alone would silently hide every cash sale.
 */
export const listSalesQuerySchema = z.object({
  /** Free-text search over the buyer's name / phone and the course title. */
  search: z.string().trim().optional(),
  /** paymob = paid online, cash = handed to the teacher in person. */
  source: z.enum(Object.values(ENROLLMENT_SOURCE) as [string, ...string[]]).optional(),
  /** active = access still open, revoked = access was pulled back. */
  status: z.enum(Object.values(ENROLLMENT_STATUS) as [string, ...string[]]).optional(),
  stage: z.enum(Object.values(STAGES) as [string, ...string[]]).optional(),
  courseId: z.string().trim().optional(),
  /** Inclusive ISO date bounds on the sale date (yyyy-mm-dd or full ISO). */
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;

/** Same filters as the list, minus pagination — used by the CSV export. */
export const exportSalesQuerySchema = listSalesQuerySchema
  .omit({ page: true, limit: true });

export type ExportSalesQuery = z.infer<typeof exportSalesQuerySchema>;
