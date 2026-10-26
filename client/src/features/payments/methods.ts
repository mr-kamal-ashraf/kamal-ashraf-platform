import type { PaymentMethod } from "@/api/types";

/** How each payment method is presented to the student, in display order. */
export const PAYMENT_METHODS: Record<
  PaymentMethod,
  { title: string; hint: string; icon: string }
> = {
  card: {
    title: "كارت بنكي",
    hint: "فيزا · ماستركارد · ميزة",
    icon: "💳",
  },
  wallet: {
    title: "محفظة إلكترونية",
    hint: "فودافون كاش · اتصالات كاش · أورنج كاش · WE Pay",
    icon: "📱",
  },
  kiosk: {
    title: "كاش في أي محل",
    hint: "أمان أو مصاري — بتاخد رقم وتدفع بيه في أقرب محل",
    icon: "🏪",
  },
};

/** An Egyptian mobile number (what a wallet is registered on). */
export const EG_PHONE = /^01[0-25]\d{8}$/;
