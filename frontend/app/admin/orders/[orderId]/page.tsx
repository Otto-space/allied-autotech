import type { Metadata } from "next";
import { StaffOrderDetail } from "../../../components/staff-order-detail";
export const metadata: Metadata = { title: "Manage order" };
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  return <StaffOrderDetail orderId={(await params).orderId} />;
}
