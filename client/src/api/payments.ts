import { apiClient } from "./client";
import type { CheckoutResponse, PaymentMethod, PaymentRecord } from "./types";

export const paymentsApi = {
  /**
   * Which of card / wallet / kiosk this platform offers, and whether card
   * fields open inside the page (Paymob Pixel) rather than on Paymob's page.
   */
  methods: () =>
    apiClient.get<{ methods: PaymentMethod[]; cardEmbedded?: boolean }>(
      "/payments/methods",
    ),

  /**
   * Start buying a course with a method: card fields to embed or a Paymob
   * page URL (card / wallet), a reference to pay in cash (kiosk — the same
   * one again while it's still payable), or free:true.
   * No method = card.
   */
  checkout: (
    courseId: string,
    options: { method?: PaymentMethod; walletPhone?: string } = {},
  ) =>
    apiClient.post<CheckoutResponse>(
      `/payments/courses/${courseId}/checkout`,
      options,
    ),

  /**
   * Back from Paymob: asks the server to check that order with Paymob now and
   * open the course if it was paid. Either id from the return URL works.
   */
  verify: (ids: { merchantOrderId?: string; paymobOrderId?: string }) =>
    apiClient.post<{
      status: "pending" | "paid" | "failed";
      courseSlug: string | null;
    }>("/payments/verify", ids),

  /** The student's own payment history. */
  listMine: () =>
    apiClient.get<{ payments: PaymentRecord[] }>("/payments/mine"),
};
