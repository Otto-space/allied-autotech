import type { Metadata } from "next";
import { StaffOrderDetail } from "../../../components/staff-order-detail";
import { notFound } from "next/navigation";
import { z } from "zod";
import "../../services/services.css";
import "./order-detail.css";
export const metadata: Metadata = { title: "Manage order" };
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) notFound();
  return <StaffOrderDetail orderId={orderId} />;
}
