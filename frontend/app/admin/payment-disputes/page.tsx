import type { Metadata } from "next";
import { PaymentDisputes } from "@/app/components/payment-disputes";
import { Suspense } from "react";
import "./payment-disputes.css";
export const metadata: Metadata = { title: "Payment disputes" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading dispute overview…</p>}>
      <PaymentDisputes />
    </Suspense>
  );
}
