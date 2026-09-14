import type { Metadata } from "next";
import { StaffOrders } from "../../components/staff-orders";
export const metadata: Metadata = { title: "Order fulfilment" };
export default function Page() {
  return <StaffOrders />;
}
