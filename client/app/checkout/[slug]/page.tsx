import type { Metadata } from "next";
import { CheckoutView } from "@/features/payments/CheckoutView";

type PageProps = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  title: "إتمام الشراء",
  // Behind login — nothing here for search engines.
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({ params }: PageProps) {
  const { slug } = await params;
  return <CheckoutView slug={slug} />;
}
