import type { Metadata } from "next";
import { OrdersPanel } from "../../components/orders-panel";
export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};
export default function OrdersPage() {
  return <OrdersPanel />;
}
