import type { Metadata } from "next";
import { OrderAftercare } from "@/app/components/order-aftercare";
import { notFound } from "next/navigation";
import { z } from "zod";
import "../../../services/services.css";
import "./aftercare.css";
export const metadata: Metadata = { title: "Order returns and cancellation review" };
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) notFound();
  return <OrderAftercare orderId={orderId} staff />;
}
