import { apiClient } from "../client";
import type { PaymentMethod } from "../types";

/**
 * Paid payments the teacher should refund (دفعات محتاجة استرجاع): money came
 * in, but no new access did — the student paid twice for a course, or paid
 * for one taken back after the payment started. They stay listed until the
 * teacher marks them dealt with.
 */

export type RefundReason = "duplicate" | "revoked_course";

export interface RefundAlert {
  id: string;
  reason: RefundReason;
  amount: number;
  currency: string;
  method: PaymentMethod;
  paidAt: string | null;
  merchantOrderId: string;
  paymobOrderId: string | null;
  paymobTransactionId: string | null;
  student: { id: string; name: string; studentPhone: string } | null;
  course: { id: string; title: string } | null;
}

export const adminPaymentsApi = {
  refundAlerts: () =>
    apiClient.get<{ items: RefundAlert[]; total: number }>(
      "/admin/payments/refund-alerts",
    ),

  resolveRefundAlert: (id: string) =>
    apiClient.post<null>(`/admin/payments/refund-alerts/${id}/resolve`),
};
