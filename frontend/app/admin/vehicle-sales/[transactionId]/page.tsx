import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StaffVehicleSaleDetail } from "@/app/components/staff-vehicle-sale-detail";
import "../../inspections/inspections.css";
import "./vehicle-sale-detail.css";
export const metadata: Metadata = { title: "Vehicle purchase" };
export default async function Page({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  if (!z.string().uuid().safeParse(transactionId).success) notFound();
  return <StaffVehicleSaleDetail transactionId={transactionId.toLowerCase()} />;
}
