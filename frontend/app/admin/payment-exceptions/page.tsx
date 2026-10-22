import type { Metadata } from "next";
import { PaymentAnomalies } from "@/app/components/payment-anomalies";
import { Suspense } from "react";
import "./payment-exceptions.css";
export const metadata: Metadata = { title: "Payment exceptions" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading exception workspace…</p>}>
      <PaymentAnomalies />
    </Suspense>
  );
}
