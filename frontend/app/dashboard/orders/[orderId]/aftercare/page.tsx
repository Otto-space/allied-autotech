import type { Metadata } from "next";
import { CustomerOrderAftercare } from "@/app/components/customer-order-aftercare";
import "./aftercare.css";
export const metadata: Metadata = { title: "Returns and cancellation requests" };
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  return <CustomerOrderAftercare orderId={(await params).orderId} />;
}
