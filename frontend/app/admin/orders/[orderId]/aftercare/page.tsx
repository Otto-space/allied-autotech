import type { Metadata } from "next";
import { OrderAftercare } from "@/app/components/order-aftercare";
export const metadata: Metadata = { title: "Order returns and cancellation review" };
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  return <OrderAftercare orderId={(await params).orderId} staff />;
}
