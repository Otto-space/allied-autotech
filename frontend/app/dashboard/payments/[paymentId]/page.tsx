import type { Metadata } from "next";
import { PaymentDetail } from "../../../components/payment-detail";
export const metadata: Metadata = {
  title: "Payment status",
  robots: { index: false, follow: false },
};
export default async function PaymentPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  return <PaymentDetail key={paymentId} paymentId={paymentId} />;
}
