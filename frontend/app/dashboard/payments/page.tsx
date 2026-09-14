import type { Metadata } from "next";
import { PaymentsPanel } from "../../components/payments-panel";
export const metadata: Metadata = {
  title: "Your payments",
  robots: { index: false, follow: false },
};
export default function PaymentsPage() {
  return <PaymentsPanel />;
}
