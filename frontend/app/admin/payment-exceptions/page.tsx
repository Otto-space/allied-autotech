import type { Metadata } from "next";
import { PaymentAnomalies } from "@/app/components/payment-anomalies";
export const metadata: Metadata = { title: "Payment exceptions" };
export default function Page() {
  return <PaymentAnomalies />;
}
