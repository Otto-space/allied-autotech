import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StaffVehicleDetail } from "@/app/components/staff-vehicle-detail";
export const metadata: Metadata = { title: "Manage vehicle stock" };
export default async function Page({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  if (!z.string().uuid().safeParse(vehicleId).success) notFound();
  return <StaffVehicleDetail vehicleId={vehicleId} />;
}
