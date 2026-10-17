import { notFound } from "next/navigation";
import { z } from "zod";
import { StaffInventoryDetail } from "@/app/components/staff-inventory-detail";
import type { Metadata } from "next";
import "../../services/services.css";
import "./inventory-detail.css";
export const metadata: Metadata = { title: "Inventory record" };
export default async function Page({
  params,
}: {
  params: Promise<{ inventoryId: string }>;
}) {
  const { inventoryId } = await params;
  if (!z.string().uuid().safeParse(inventoryId).success) notFound();
  return <StaffInventoryDetail inventoryId={inventoryId} />;
}
