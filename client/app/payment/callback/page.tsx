import type { Metadata } from "next";
import { PaymentCallbackView } from "@/features/payments/PaymentCallbackView";

export const metadata: Metadata = {
  title: "نتيجة الدفع",
  robots: { index: false, follow: false },
};

export default function PaymentCallbackPage() {
  return <PaymentCallbackView />;
}
