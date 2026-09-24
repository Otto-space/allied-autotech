import type { Metadata } from "next";
import { OrderAftercare } from "@/app/components/order-aftercare";
export const metadata: Metadata = { title: "Returns and cancellation requests" };
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  return <OrderAftercare orderId={(await params).orderId} />;
}
