import { notFound } from "next/navigation";
import { z } from "zod";
import { PurchaseAftercarePage } from "../../../../components/purchase-aftercare";
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) notFound();
  return <PurchaseAftercarePage orderId={orderId} />;
}
