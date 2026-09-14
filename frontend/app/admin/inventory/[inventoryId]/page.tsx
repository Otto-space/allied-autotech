import { notFound } from "next/navigation";
import { z } from "zod";
import { StaffInventoryDetail } from "@/app/components/staff-inventory-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ inventoryId: string }>;
}) {
  const { inventoryId } = await params;
  if (!z.string().uuid().safeParse(inventoryId).success) notFound();
  return <StaffInventoryDetail inventoryId={inventoryId} />;
}
