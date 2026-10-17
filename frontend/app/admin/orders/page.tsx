import type { Metadata } from "next";
import { StaffOrders } from "../../components/staff-orders";
import "../services/services.css";
import "./orders.css";
export const metadata: Metadata = { title: "Order fulfilment" };
export default function Page() {
  return <StaffOrders />;
}
