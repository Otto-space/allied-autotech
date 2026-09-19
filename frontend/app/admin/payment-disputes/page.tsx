import type { Metadata } from "next";
import { PaymentDisputes } from "@/app/components/payment-disputes";
export const metadata: Metadata = { title: "Payment disputes" };
export default function Page() {
  return <PaymentDisputes />;
}
